import { projectRepository } from "../repositories/project.repository.js";
import { userRepository } from "../repositories/user.repository.js";
import { prisma } from "../repositories/prisma.js";
import { matchingService } from "./matching.service.js";
import { NotFoundError, ForbiddenError, ConflictError } from "../utils/errors.js";
import { buildPaginatedResponse, toPageParams } from "../utils/pagination.js";
import type { CreateProjectRequest, UpdateProjectRequest, ProjectStatus } from "@app/shared-types";

export async function list(params: {
  cursor?: string;
  limit: number;
  status?: string;
  skill?: string;
  topic?: string;
  lookingFor?: string;
}) {
  const { skip, take } = toPageParams(params.cursor, params.limit);
  const items = await projectRepository.list({ ...params, skip, take });
  return buildPaginatedResponse(items, skip, take);
}

export async function getById(id: string, viewerId?: string) {
  const project = await projectRepository.findById(id);
  if (!project) throw new NotFoundError("Project not found");

  // Visibility enforcement (spec §4/§5): private projects are only
  // visible to the creator and accepted members. Server-side — the
  // frontend never decides.
  if (project.visibility === "private" && project.createdBy !== viewerId) {
    const isMember = viewerId
      ? await prisma.projectMember.findUnique({
          where: { projectId_userId: { projectId: id, userId: viewerId } },
        })
      : null;
    if (!isMember) throw new NotFoundError("Project not found");
  }

  return project;
}

export async function create(userId: string, input: CreateProjectRequest) {
  return projectRepository.create(
    {
      name: input.name,
      logoUrl: input.logoUrl,
      problemStatement: input.problemStatement,
      solutionDescription: input.solutionDescription,
      description: input.description,
      status: input.status,
      githubUrl: input.githubUrl,
      demoUrl: input.demoUrl,
      docsUrl: input.docsUrl,
      creator: { connect: { id: userId } },
      members: { create: { userId, roleOnProject: "Creator" } },
    },
    input.topicIds ?? [],
    input.skillsNeeded ?? [],
  );
}

export async function update(userId: string, id: string, input: UpdateProjectRequest) {
  const existing = await projectRepository.findById(id);
  if (!existing) throw new NotFoundError("Project not found");
  const isOwner = await projectRepository.isOwner(id, userId);
  if (!isOwner) throw new ForbiddenError("Only the project creator can edit this project");
  return projectRepository.update(id, {
    name: input.name,
    logoUrl: input.logoUrl,
    problemStatement: input.problemStatement,
    solutionDescription: input.solutionDescription,
    description: input.description,
    status: input.status,
    githubUrl: input.githubUrl,
    demoUrl: input.demoUrl,
    docsUrl: input.docsUrl,
  });
}

/** Hard delete is not used for projects — see DECISIONS.md D-013 ("soft-delete where applicable"): archiving via status is the applicable case here. */
export async function remove(userId: string, id: string) {
  const existing = await projectRepository.findById(id);
  if (!existing) throw new NotFoundError("Project not found");
  const isOwner = await projectRepository.isOwner(id, userId);
  if (!isOwner) throw new ForbiddenError("Only the project creator can archive this project");
  await projectRepository.archive(id);
}

export async function join(userId: string, projectId: string, roleOnProject?: string) {
  const project = await projectRepository.findById(projectId);
  if (!project) throw new NotFoundError("Project not found");
  const alreadyMember = await projectRepository.isOwnerOrMember(projectId, userId);
  if (alreadyMember) throw new ConflictError("Already a member of this project");
  return prisma.projectMember.create({ data: { projectId, userId, roleOnProject } });
}

export async function leave(userId: string, projectId: string) {
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (!membership) throw new NotFoundError("Membership not found");
  await prisma.projectMember.delete({ where: { projectId_userId: { projectId, userId } } });
}

/**
 * Explainable candidate matching per API_CONTRACT.md §5 / ARCHITECTURE.md §6
 * — scores active users against the project's declared skill/topic needs
 * using matching.service.ts (Phase 3, unmodified). MVP candidate pool is
 * capped at 200 users (see project.repository.ts) rather than scored
 * server-wide; acceptable for the project's expected scale per PROJECT_SPEC.md,
 * flagged here for whichever later phase adds real search-index-backed
 * candidate retrieval.
 */
export async function findMatches(requesterId: string, projectId: string, limit: number) {
  const project = await projectRepository.findById(projectId);
  if (!project) throw new NotFoundError("Project not found");
  // API_CONTRACT.md §5: "project owner/member only" — not owner-only.
  const canView = await projectRepository.isOwnerOrMember(projectId, requesterId);
  if (!canView)
    throw new ForbiddenError("Only the project creator or a member can view match candidates");

  const excludeIds = project.members.map((m) => m.userId);
  const candidates = await projectRepository.findMatchCandidates(projectId, excludeIds);

  const requirements = {
    skillsNeeded: project.skillsNeeded.map((s) => s.skill.name),
    researchTopics: project.topics.map((t) => t.researchTopic.name),
  };

  const scored = candidates.map((c) => {
    const isConnected = [...c.connectionsSent, ...c.connectionsReceived].some(
      (conn) => conn.requesterId === requesterId || conn.addresseeId === requesterId,
    );
    return matchingService.computeMatch(
      {
        userId: c.id,
        skills: c.userSkills.map((s) => s.skill.name),
        researchTopics: c.userResearchTopics.map((t) => t.researchTopic.name),
        department:
          c.studentProfile?.department ??
          c.professorProfile?.department ??
          c.researcherProfile?.department ??
          undefined,
        availability: c.researcherProfile?.currentAvailability ?? true,
        isConnected,
      },
      requirements,
    );
  });

  return scored.sort((a, b) => b.matchScore - a.matchScore).slice(0, limit);
}

/**
 * ============================================================================
 * PROFESSOR PROJECT MANAGEMENT (New functionality for Phase 9+)
 * ============================================================================
 * 
 * These functions allow verified professors to manage their projects.
 * Ownership is determined by the `createdBy` field.
 */

// Project status values come from the shared-types ProjectStatus (single
// source of truth, matching the Prisma enum). No local duplicate enum.

const VALID_PROJECT_TRANSITIONS: Record<string, string[]> = {
  idea: ['planning', 'archived'],
  planning: ['development', 'archived'],
  development: ['beta', 'active', 'archived'],
  beta: ['active', 'archived'],
  active: ['completed', 'archived'],
  completed: ['archived'],
  archived: [],
} as const;

/**
 * Professor adds a member to their project
 */
export async function addMemberByProfessor(
  professorId: string,
  projectId: string,
  userId: string,
  roleOnProject?: string
) {
  // Check ownership - professor must be creator
  const existing = await prisma.project.findFirst({
    where: { id: projectId, createdBy: professorId },
  });
  if (!existing) throw new ForbiddenError("Only the project creator can manage members");

  // Check if user is already a member
  const alreadyMember = await projectRepository.isOwnerOrMember(projectId, userId);
  if (alreadyMember) throw new ConflictError("Already a member of this project");

  // Verify the user being added is a valid student or researcher
  const user = await userRepository.findById(userId);
  if (!user) throw new NotFoundError("User not found");

  return prisma.projectMember.create({
    data: { projectId, userId, roleOnProject },
  });
}

/**
 * Professor removes a member from their project
 */
export async function removeMemberByProfessor(
  professorId: string,
  projectId: string,
  userId: string
) {
  // Check ownership
  const existing = await prisma.project.findFirst({
    where: { id: projectId, createdBy: professorId },
  });
  if (!existing) throw new ForbiddenError("Only the project creator can manage members");

  // Cannot remove the creator themselves
  if (userId === existing.createdBy) {
    throw new ForbiddenError("Cannot remove the project creator from the project");
  }

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (!membership) throw new NotFoundError("Membership not found");

  await prisma.projectMember.delete({ where: { projectId_userId: { projectId, userId } } });
}

/**
 * Professor updates a member's role in their project
 */
export async function updateMemberRoleByProfessor(
  professorId: string,
  projectId: string,
  userId: string,
  newRole: string
) {
  // Check ownership
  const existing = await prisma.project.findFirst({
    where: { id: projectId, createdBy: professorId },
  });
  if (!existing) throw new ForbiddenError("Only the project creator can manage members");

  // Cannot change creator's role
  if (userId === existing.createdBy) {
    throw new ForbiddenError("Cannot change the project creator's role");
  }

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (!membership) throw new NotFoundError("Membership not found");

  return prisma.projectMember.update({
    where: { projectId_userId: { projectId, userId } },
    data: { roleOnProject: newRole },
  });
}

/**
 * Professor updates their project lifecycle status
 * Validates valid state transitions
 */
export async function updateStatusByProfessor(professorId: string, id: string, newStatus: ProjectStatus) {
  const existing = await projectRepository.findById(id);
  if (!existing) throw new NotFoundError("Project not found");

  // Check ownership
  if (existing.createdBy !== professorId) {
    throw new ForbiddenError("Only the project creator can update project status");
  }

  const currentStatus = existing.status;
  const validNextStatuses = VALID_PROJECT_TRANSITIONS[currentStatus as keyof typeof VALID_PROJECT_TRANSITIONS] || [];
  
  if (!validNextStatuses.includes(newStatus)) {
    throw new ForbiddenError(`Invalid status transition from ${currentStatus} to ${newStatus}`);
  }

  return projectRepository.update(id, { status: newStatus });
}

/**
 * Professor gets their own projects
 */
export async function listByProfessor(professorId: string, params: {
  cursor?: string;
  limit: number;
  status?: string;
  skill?: string;
  topic?: string;
  lookingFor?: string;
}) {
  const { skip, take } = toPageParams(params.cursor, params.limit);
  // Filter by creator
  const items = await projectRepository.list({ ...params, skip, take, createdBy: professorId });
  return buildPaginatedResponse(items, skip, take);
}
