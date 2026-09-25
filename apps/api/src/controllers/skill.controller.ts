import type { Request, Response, NextFunction } from "express";
import * as skillService from "../services/skill.service.js";
import type { CreateSkillRequest, PaginationQuery, SkillProficiency } from "@app/shared-types";

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { cursor, limit } = req.query as unknown as PaginationQuery;
    const { category, q } = req.query as Record<string, string | undefined>;
    res.status(200).json(await skillService.list(cursor, limit, category, q));
  } catch (err: unknown) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await skillService.create(req.body as CreateSkillRequest);
    res.status(201).json(result);
  } catch (err: unknown) {
    next(err);
  }
}

export async function addToSelf(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { proficiency } = req.body as { proficiency?: SkillProficiency };
    const result = await skillService.addToSelf(req.user!.id, req.params.id as string, proficiency);
    res.status(201).json(result);
  } catch (err: unknown) {
    next(err);
  }
}

export async function removeFromSelf(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await skillService.removeFromSelf(req.user!.id, req.params.id as string);
    res.status(204).send();
  } catch (err: unknown) {
    next(err);
  }
}

export async function addSkillToSelf(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { skillId, proficiency } = req.body as {
      skillId: string;
      proficiency?: SkillProficiency;
    };

    const result = await skillService.addToSelf(req.user!.id, skillId, proficiency);
    res.status(201).json(result);
  } catch (err: unknown) {
    next(err);
  }
}
