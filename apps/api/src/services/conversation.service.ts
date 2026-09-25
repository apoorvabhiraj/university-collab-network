import { prisma } from "../repositories/prisma.js";
import { conversationRepository } from "../repositories/conversation.repository.js";
import { connectionRepository } from "../repositories/connection.repository.js";
import { notificationRepository } from "../repositories/notification.repository.js";
import { NotFoundError, ForbiddenError, BadRequestError } from "../utils/errors.js";
import { buildPaginatedResponse, toPageParams } from "../utils/pagination.js";
import type { CreateConversationRequest, CreateMessageRequest } from "@app/shared-types";
import { messageBus } from "./messageBus.js";

/**
 * ONE authoritative open-or-create for direct conversations: returns the
 * existing direct conversation between the two users (findExistingDirect
 * de-dup) or creates exactly one. Every Message entry point in the
 * product (profile, search, discover, project/team members, notifications)
 * routes through THIS operation — no per-context duplicates.
 */
export async function openOrCreateDirect(userId: string, targetUserId: string) {
  if (userId === targetUserId) {
    throw new BadRequestError("You cannot start a conversation with yourself");
  }
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, status: true },
  });
  if (!target) throw new NotFoundError("User not found");
  if (target.status === "suspended" || target.status === "banned") {
    throw new ForbiddenError("This user cannot receive messages");
  }
  // Messaging + connections (Instagram-style request pattern): a
  // non-connected user may send ONE initial message — a message request.
  // The recipient's first REPLY auto-accepts the connection, unlocking
  // free conversation for both. Enforced server-side — never only in the UI.
  const existing = await conversationRepository.findExistingDirect([userId, targetUserId]);
  if (existing) return existing;
  // Seed an implicit PENDING connection (the message request) — visible in
  // the recipient's dashboard inbox; their reply auto-accepts it.
  const existingConnection = await connectionRepository.findBetween(userId, targetUserId);
  if (!existingConnection) {
    try {
      await connectionRepository.create(userId, targetUserId, "");
    } catch {
      // a race — the connection may already exist
    }
  }
  return conversationRepository.create({
    type: "direct",
    participantIds: [userId, targetUserId],
  });
}

export async function create(userId: string, input: CreateConversationRequest) {
  const participantIds = Array.from(new Set([userId, ...input.participantIds]));

  if (input.type === "direct") {
    if (participantIds.length !== 2) {
      throw new BadRequestError("A direct conversation must have exactly two participants");
    }
    const existing = await conversationRepository.findExistingDirect(participantIds);
    if (existing) return existing;
  }

  // CRITICAL authorization: project/team chats are member-only workspaces.
  // Without this check, any authenticated user could create a project
  // conversation for ANY project, become a participant, and gain full
  // chat access (read/send/stream all check conversation_participants).
  if (input.projectId) {
    await assertProjectChatAccess(input.projectId, userId);
  }
  if (input.researchTeamId) {
    await assertTeamChatAccess(input.researchTeamId, userId);
  }

  return conversationRepository.create({
    type: input.type,
    participantIds,
    projectId: input.projectId,
    researchTeamId: input.researchTeamId,
    organizationId: input.organizationId,
    groupId: input.groupId,
  });
}

export async function list(userId: string, cursor: string | undefined, limit: number) {
  const { skip, take } = toPageParams(cursor, limit);
  const items = await conversationRepository.listForUser(userId, { skip, take });
  return buildPaginatedResponse(items, skip, take);
}

export async function listForUserWithUnread(userId: string, cursor: string | undefined, limit: number) {
  const { skip, take } = toPageParams(cursor, limit);
  const items = await conversationRepository.listForUserWithUnread(userId, { skip, take });
  return buildPaginatedResponse(items, skip, take);
}

async function assertParticipant(conversationId: string, userId: string) {
  const isParticipant = await conversationRepository.isParticipant(conversationId, userId);
  if (!isParticipant) throw new ForbiddenError("You are not a participant in this conversation");
}

export async function assertParticipantForStream(conversationId: string, userId: string) {
  await assertParticipant(conversationId, userId);
}

/** Project chat is member-only: the requester must be the creator or an
 * accepted project member. Server-side — the frontend never decides. */
async function assertProjectChatAccess(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new NotFoundError("Project not found");
  if (project.createdBy === userId) return;
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (!member) throw new ForbiddenError("Only project members can access project chat");
}

/** Research-team chat is member-only: PI, creator, or accepted member. */
async function assertTeamChatAccess(researchTeamId: string, userId: string) {
  const team = await prisma.researchTeam.findUnique({ where: { id: researchTeamId } });
  if (!team) throw new NotFoundError("Research team not found");
  if (team.piUserId === userId || team.createdBy === userId) return;
  const member = await prisma.membership.findFirst({
    where: { researchTeamId, userId },
  });
  if (!member) throw new ForbiddenError("Only team members can access team chat");
}

/**
 * Real unread state — opening the conversation updates the participant's
 * lastReadAt (database-authoritative; refreshing preserves it).
 */
export async function markConversationRead(conversationId: string, userId: string) {
  await assertParticipant(conversationId, userId);
  await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId } },
    data: { lastReadAt: new Date() },
  });
  return { read: true };
}

export async function getById(userId: string, id: string) {
  await assertParticipant(id, userId);
  const conversation = await conversationRepository.findById(id);
  if (!conversation) throw new NotFoundError("Conversation not found");
  return conversation;
}

export async function listMessages(
  userId: string,
  conversationId: string,
  cursor: string | undefined,
  limit: number,
) {
  await assertParticipant(conversationId, userId);
  const { skip, take } = toPageParams(cursor, limit);
  const items = await conversationRepository.listMessages(conversationId, { skip, take });
  return buildPaginatedResponse(items, skip, take);
}

export async function sendMessage(
  userId: string,
  conversationId: string,
  input: CreateMessageRequest,
) {
  await assertParticipant(conversationId, userId);

  const conv = await conversationRepository.findById(conversationId);
  const otherId = conv?.participants?.map((p) => p.userId).find((id) => id !== userId) ?? null;

  // Message-request rule (server-enforced): in a conversation between
  // NON-connected users, the sender may send exactly ONE initial message
  // until the recipient replies.
  const connected = otherId ? await connectionRepository.areConnected(userId, otherId) : true;
  if (!connected) {
    const myMessages = await prisma.message.count({
      where: { conversationId, senderId: userId },
    });
    if (myMessages >= 1) {
      throw new ForbiddenError(
        "Your message request is waiting for a reply — they can reply to unlock the conversation",
      );
    }
  }

  // The RECIPIENT replying auto-accepts the pending connection — both
  // parties can now converse freely (the Instagram unlock). The REQUESTER
  // sending more messages never auto-accepts their own request (that would
  // bypass the recipient's consent AND the 1-message rule).
  if (otherId && !connected) {
    const pending = await connectionRepository.findBetween(userId, otherId);
    if (pending && pending.status === "pending" && pending.requesterId === otherId) {
      try {
        await connectionRepository.updateStatus(pending.id, "accepted");
        await notificationRepository.create(otherId, "connection_request", {
          connectionId: pending.id,
          responderId: userId,
          status: "accepted",
        });
      } catch {
        // Non-blocking side effect
      }
    }
  }

  const msg = await conversationRepository.createMessage({
    conversationId,
    senderId: userId,
    body: input.body,
    attachmentUrl: input.attachmentUrl,
    invitationType: input.invitationType,
    invitationRefId: input.invitationRefId,
  });

  // Realtime delivery — SSE subscribers get the message immediately
  messageBus.publish(conversationId, msg);

  try {
    const conv = await conversationRepository.findById(conversationId);
    if (conv && conv.participants) {
      for (const p of conv.participants) {
        if (p.userId !== userId) {
          let notifType = "new_message";
          if (input.invitationType === "project") notifType = "project_invitation";
          else if (input.invitationType === "research_team") notifType = "research_invitation";

          await notificationRepository.create(p.userId, notifType, {
            conversationId,
            messageId: msg.id,
            senderId: userId,
            invitationType: input.invitationType,
            invitationRefId: input.invitationRefId,
          });
        }
      }
    }
  } catch {
    // Non-blocking notification side effect
  }

  return msg;
}
