import { skillRepository } from "../repositories/skill.repository.js";
import { prisma } from "../repositories/prisma.js";
import { ConflictError, NotFoundError } from "../utils/errors.js";
import { buildPaginatedResponse, toPageParams } from "../utils/pagination.js";
import type { CreateSkillRequest, SkillProficiency } from "@app/shared-types";

export async function list(cursor: string | undefined, limit: number, category?: string, q?: string) {
  const { skip, take } = toPageParams(cursor, limit);
  const items = await skillRepository.list({ skip, take, category, q });
  return buildPaginatedResponse(items, skip, take);
}

export async function create(input: CreateSkillRequest) {
  const existing = await skillRepository.findByName(input.name);
  if (existing) throw new ConflictError("A skill with this name already exists");
  return skillRepository.create({ name: input.name, category: input.category });
}

export async function addToSelf(userId: string, skillId: string, proficiency?: SkillProficiency) {
  const skill = await skillRepository.findById(skillId);
  if (!skill) throw new NotFoundError("Skill not found");
  return prisma.userSkill.upsert({
    where: { userId_skillId: { userId, skillId } },
    create: { userId, skillId, proficiency },
    update: { proficiency },
  });
}

export async function removeFromSelf(userId: string, skillId: string) {
  const existing = await prisma.userSkill.findUnique({
    where: { userId_skillId: { userId, skillId } },
  });
  if (!existing) throw new NotFoundError("You do not have this skill listed");
  await prisma.userSkill.delete({ where: { userId_skillId: { userId, skillId } } });
}
