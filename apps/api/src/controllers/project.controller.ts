import type { Request, Response, NextFunction } from "express";
import * as projectService from "../services/project.service.js";
import type {
  CreateProjectRequest,
  UpdateProjectRequest,
  ProjectStatus,
  PaginationQuery,
} from "@app/shared-types";

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { cursor, limit } = req.query as unknown as PaginationQuery;
    const { status, skill, topic, lookingFor } = req.query as Record<string, string | undefined>;
    res
      .status(200)
      .json(await projectService.list({ cursor, limit, status, skill, topic, lookingFor }));
  } catch (err: unknown) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res
      .status(200)
      .json(await projectService.getById(req.params.id as string, req.user?.id));
  } catch (err: unknown) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await projectService.create(req.user!.id, req.body as CreateProjectRequest);
    res.status(201).json(result);
  } catch (err: unknown) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await projectService.update(
      req.user!.id,
      req.params.id as string,
      req.body as UpdateProjectRequest,
    );
    res.status(200).json(result);
  } catch (err: unknown) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await projectService.remove(req.user!.id, req.params.id as string);
    res.status(204).send();
  } catch (err: unknown) {
    next(err);
  }
}

export async function join(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { roleOnProject } = req.body as { roleOnProject?: string };
    const result = await projectService.join(req.user!.id, req.params.id as string, roleOnProject);
    res.status(201).json(result);
  } catch (err: unknown) {
    next(err);
  }
}

export async function leave(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await projectService.leave(req.user!.id, req.params.id as string);
    res.status(204).send();
  } catch (err: unknown) {
    next(err);
  }
}

export async function matches(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const result = await projectService.findMatches(req.user!.id, req.params.id as string, limit);
    res.status(200).json({ data: result });
  } catch (err: unknown) {
    next(err);
  }
}

// ============================================================================
// PROFESSOR PROJECT ENDPOINTS (Phase 9+)
// Eligibility/ownership is enforced at the route level via
// requireProfessorVerified / requireProfessorOwnership middleware.
// ============================================================================

// Professor adds a member to their project
export async function addMemberByProfessor(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, roleOnProject } = req.body as { userId: string; roleOnProject?: string };
    const result = await projectService.addMemberByProfessor(
      req.user!.id,
      req.params.id as string,
      userId,
      roleOnProject,
    );
    res.status(201).json(result);
  } catch (err: unknown) {
    next(err);
  }
}

// Professor removes a member from their project
export async function removeMemberByProfessor(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = req.body as { userId: string };
    await projectService.removeMemberByProfessor(req.user!.id, req.params.id as string, userId);
    res.status(204).send();
  } catch (err: unknown) {
    next(err);
  }
}

// Professor updates a member's role in their project
export async function updateMemberRoleByProfessor(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, roleOnProject } = req.body as { userId: string; roleOnProject: string };
    const result = await projectService.updateMemberRoleByProfessor(
      req.user!.id,
      req.params.id as string,
      userId,
      roleOnProject,
    );
    res.status(200).json(result);
  } catch (err: unknown) {
    next(err);
  }
}

// Professor updates their project lifecycle status
export async function updateStatusByProfessor(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await projectService.updateStatusByProfessor(
      req.user!.id,
      req.params.id as string,
      req.body.status as ProjectStatus,
    );
    res.status(200).json(result);
  } catch (err: unknown) {
    next(err);
  }
}

// Professor lists their own projects
export async function listByProfessor(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { cursor, limit, status, skill, topic, lookingFor } = req.query as unknown as {
      cursor?: string;
      limit?: number;
      status?: string;
      skill?: string;
      topic?: string;
      lookingFor?: string;
    };
    const result = await projectService.listByProfessor(req.user!.id, {
      cursor,
      limit: limit ?? 10,
      status,
      skill,
      topic,
      lookingFor,
    });
    res.status(200).json(result);
  } catch (err: unknown) {
    next(err);
  }
}
