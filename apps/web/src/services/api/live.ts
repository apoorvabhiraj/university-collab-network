import type { SkillRoleNeeded, UserProfileResponse } from '@app/shared-types';
import { API_BASE_URL } from '../../lib/config';
import { apiFetch } from './client';
import { authApi } from './auth';
import {
  mapApiUser,
  mapApiProject,
  mapApiEvent,
  mapApiConversation,
  mapApiMessage,
  mapApiNotification,
  mapApiJoinRequestAsApplication,
  mapApiConnection,
  str,
  initialsAvatar,
  roleLabel,
} from './adapters';
import type {
  User,
  Project,
  PortfolioItem,
  Community,
  CampusEvent,
  CouncilAnnouncement,
  ProjectApplication,
  Connection,
  Startup,
  Conversation,
  Message,
  NotificationItem,
} from '../../types';

type AnyRow = Record<string, unknown>;

/* ============================================================================
 * Live data layer — fetches the platform's real state from the UCN API and
 * maps it onto the Campus UI's types. Used only when API_MODE === 'live'.
 * ==========================================================================*/

const COVER_PALETTES = [
  ['4f46e5', '818cf8', 'c7d2fe'],
  ['0891b2', '22d3ee', 'a5f3fc'],
  ['059669', '34d399', 'a7f3d0'],
  ['d97706', 'fbbf24', 'fde68a'],
  ['7c3aed', 'a78bfa', 'ddd6fe'],
  ['db2777', 'f472b6', 'fbcfe8'],
];

function gradientCover(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const [c1, c2, c3] = COVER_PALETTES[hash % COVER_PALETTES.length]!;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='240'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='#${c1}'/><stop offset='55%' stop-color='#${c2}'/><stop offset='100%' stop-color='#${c3}'/></linearGradient></defs><rect width='800' height='240' fill='url(#g)'/><circle cx='680' cy='40' r='120' fill='white' fill-opacity='0.08'/><circle cx='120' cy='220' r='90' fill='white' fill-opacity='0.06'/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

async function fetchPage(path: string): Promise<AnyRow[]> {
  const page = await apiFetch<{ data?: AnyRow[] }>(path);
  return page.data ?? [];
}

/** Resolve free-text skill names to skill UUIDs (create missing ones) —
 * the API's skillsNeeded contract works with IDs, not names.
 *
 * Paginates the FULL taxonomy (the API paginates at 100/page — a single
 * page hid Python/React/TypeScript, so existing skills were "created"
 * again → unique-constraint errors → project creation failed). Creation
 * of a missing skill is duplicate-safe: on conflict, re-fetch + find. */
async function resolveSkills(
  names: string[],
): Promise<{ skillId: string; roleNeeded: SkillRoleNeeded }[]> {
  if (names.length === 0) return [];

  const byName = new Map<string, string>();
  let cursor: string | null = null;
  for (let i = 0; i < 5; i++) {
    const page = await apiFetch<{ data?: AnyRow[]; nextCursor?: string | null }>(
      `/skills?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
    );
    for (const s of page.data ?? []) {
      byName.set(String(s.name ?? '').toLowerCase().trim(), String(s.id));
    }
    cursor = page.nextCursor ?? null;
    if (!cursor) break;
  }

  const out: { skillId: string; roleNeeded: SkillRoleNeeded }[] = [];
  for (const rawName of names) {
    const key = rawName.toLowerCase().trim();
    if (!key) continue;
    let id = byName.get(key);
    if (!id) {
      try {
        const created = await apiFetch<AnyRow>('/skills', {
          method: 'POST',
          body: { name: rawName.trim() },
        });
        id = String(created.id);
      } catch {
        // The skill already exists (unique name) — re-fetch and find it
        const rows = await fetchPage(`/skills?limit=100&q=${encodeURIComponent(rawName.trim())}`);
        id = rows
          .map((s) => [String(s.name ?? '').toLowerCase().trim(), String(s.id)] as const)
          .find(([n]) => n === key)?.[1] ?? '';
      }
      if (!id) continue;
      byName.set(key, id);
    }
    out.push({ skillId: id, roleNeeded: inferRole(rawName) });
  }
  return out;
}

function inferRole(name: string): SkillRoleNeeded {
  const n = name.toLowerCase();
  if (/react|vue|angular|frontend|front-end|css|html|tailwind|next\.?js/.test(n)) return 'frontend';
  if (/node|express|backend|back-end|api|database|sql|postgres|mongo|django|flask/.test(n)) return 'backend';
  if (/\bml\b|machine learning|\bai\b|pytorch|tensorflow|data sci|llm|nlp/.test(n)) return 'ml';
  if (/figma|design|\bui\b|\bux\b|prototype/.test(n)) return 'design';
  if (/research|paper|writing|latex|academic|publication/.test(n)) return 'research';
  if (/product|manager|\bpm\b/.test(n)) return 'product';
  return 'other';
}

/* --------------------------- initial bootstrap ---------------------------- */

export interface LiveBootstrap {
  users: User[];
  projects: Project[];
  portfolio: PortfolioItem[];
  communities: Community[];
  events: CampusEvent[];
  announcements: CouncilAnnouncement[];
  applications: ProjectApplication[];
  connections: Connection[];
  startups: Startup[];
  conversations: Conversation[];
  messages: Message[];
  notifications: NotificationItem[];
}

async function fetchUsers(): Promise<User[]> {
  // The API's user list includes role profiles + goals (combined-project
  // extension) — ONE paginated request renders the directory. No per-user
  // hydration N+1 (168 parallel requests stalled the bootstrap on mobile).
  const rows: AnyRow[] = [];
  let cursor: string | null = null;
  for (let i = 0; i < 10; i++) {
    const page = await apiFetch<{ data?: AnyRow[]; nextCursor?: string | null }>(
      `/users?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
    );
    rows.push(...(page.data ?? []));
    cursor = page.nextCursor ?? null;
    if (!cursor) break;
  }
  return rows.map((r) => mapApiUser(r as unknown as UserProfileResponse));
}

async function fetchCommunities(currentUserId: string): Promise<Community[]> {
  let orgs: AnyRow[] = [];
  try {
    orgs = await fetchPage('/organizations?limit=50');
  } catch {
    return [];
  }

  const detailed = await Promise.all(
    orgs.slice(0, 30).map(async (org) => {
      const slug = String(org.slug ?? '');
      if (!slug) return org;
      try {
        return await apiFetch<AnyRow>(`/organizations/${encodeURIComponent(slug)}`);
      } catch {
        return org;
      }
    }),
  );

  return detailed.map((org) => {
    const name = String(org.name ?? 'Community');
    const memberships = Array.isArray(org.memberships) ? (org.memberships as AnyRow[]) : [];
    const memberIds = memberships
      .map((m) => String((m.user as AnyRow | undefined)?.id ?? ''))
      .filter(Boolean);
    const leadRoles = new Set(['leader', 'founder', 'pi', 'creator']);
    const leads = memberships
      .filter((m) => leadRoles.has(String(m.role ?? m.membershipRole ?? 'member')))
      .map((m) => String((m.user as AnyRow | undefined)?.id ?? ''))
      .filter(Boolean);

    const type = String(org.type ?? 'club');
    const category =
      type === 'club' ? 'Club' : type === 'startup' ? 'Design Studio' : 'Tech Society';

    return {
      id: String(org.id),
      name,
      handle: String(org.slug ?? name.toLowerCase().replace(/\s+/g, '-')),
      description: String(org.description ?? ''),
      logo: String(org.logoUrl ?? '') || initialsAvatar(name),
      coverImage: gradientCover(name),
      category,
      university: 'University',
      memberCount: memberIds.length,
      leads: leads.length > 0 ? leads : memberIds.slice(0, 1),
      members: memberIds,
      isJoined: memberIds.includes(currentUserId),
      upcomingEventTitle: undefined,
    } satisfies Community;
  });
}

async function fetchConversationsAndMessages(): Promise<{
  conversations: Conversation[];
  messages: Message[];
}> {
  let convRows: AnyRow[] = [];
  try {
    convRows = await fetchPage('/conversations?limit=50');
  } catch {
    return { conversations: [], messages: [] };
  }

  const conversations = convRows.map((c) => mapApiConversation(c));

  const messageArrays = await Promise.all(
    conversations.map(async (c) => {
      try {
        const rows = await fetchPage(`/conversations/${c.id}/messages?limit=100`);
        // The API returns sentAt DESC (newest first) — the UI renders
        // chronological order (oldest at top). Sort ascending before mapping.
        rows.sort(
          (a, b) => new Date(String(a.sentAt ?? 0)).getTime() - new Date(String(b.sentAt ?? 0)).getTime(),
        );
        return rows.map((m) => mapApiMessage(m, c.id));
      } catch {
        return [] as Message[];
      }
    }),
  );

  const messages = messageArrays.flat();
  return { conversations, messages };
}

async function fetchApplications(currentUserId: string): Promise<ProjectApplication[]> {
  const received = await fetchPage('/projects?limit=50');
  const mine = received.filter((p) => String((p.creator as AnyRow | undefined)?.id ?? '') === currentUserId);

  const requestArrays = await Promise.all(
    mine.map(async (p) => {
      try {
        return await fetchPage(`/projects/${String(p.id)}/join-requests?limit=50`);
      } catch {
        return [] as AnyRow[];
      }
    }),
  );

  const receivedApps = requestArrays.flat().map((r) => mapApiJoinRequestAsApplication(r, true));

  let sentRaw: AnyRow[] = [];
  try {
    sentRaw = await fetchPage('/users/me/join-requests');
  } catch {
    sentRaw = [];
  }
  const sentApps = sentRaw.map((r) => mapApiJoinRequestAsApplication(r, false));

  return [...receivedApps, ...sentApps];
}

async function fetchConnections(): Promise<Connection[]> {
  try {
    const rows = await fetchPage('/connections?limit=50');
    return rows.map((r) => mapApiConnection(r));
  } catch {
    return [];
  }
}


async function fetchStartups(currentUserId: string): Promise<Startup[]> {
  let orgs: AnyRow[] = [];
  try {
    orgs = await fetchPage('/organizations?type=startup&limit=50');
  } catch {
    return [];
  }

  const detailed = await Promise.all(
    orgs.slice(0, 30).map(async (org) => {
      const slug = String(org.slug ?? '');
      if (!slug) return org;
      try {
        return await apiFetch<AnyRow>(`/organizations/${encodeURIComponent(slug)}`);
      } catch {
        return org;
      }
    }),
  );

  return detailed.map((org) => {
    const name = String(org.name ?? 'Startup');
    const memberships = Array.isArray(org.memberships) ? (org.memberships as AnyRow[]) : [];
    const memberIds = memberships
      .map((m) => String((m.user as AnyRow | undefined)?.id ?? ''))
      .filter(Boolean);
    const details = (org.startupDetails ?? {}) as AnyRow;
    const stage = str(details.stage) || 'ongoing';
    const allowed = ['ongoing', 'completed', 'incubated', 'graduated'];

    return {
      id: String(org.id),
      name,
      slug: String(org.slug ?? ''),
      logo: String(org.logoUrl ?? '') || initialsAvatar(name),
      description: str(org.description),
      category: str(org.category) || str(details.industry) || 'Startup',
      status: (allowed.includes(stage) ? stage : 'ongoing') as Startup['status'],
      industry: str(details.industry),
      stage,
      websiteUrl: str(details.websiteUrl) || undefined,
      hiring: !!details.hiring,
      founders: memberIds.slice(0, 4),
      memberCount: memberIds.length,
      university: 'University',
      isJoined: memberIds.includes(currentUserId),
      createdAt: str(org.createdAt, new Date().toISOString()).slice(0, 10),
    } satisfies Startup;
  });
}

export async function fetchLiveBootstrap(currentUserId: string): Promise<LiveBootstrap> {
  const [users, projects, events, convData, notifications, applications, connections, communities, startups] =
    await Promise.all([
      fetchUsers(),
      fetchPage('/projects?limit=50').then((rows) => rows.map((r) => mapApiProject(r))).catch(() => [] as Project[]),
      fetchPage('/events?limit=50')
        .then((rows) => rows.map((r) => mapApiEvent(r, currentUserId)))
        .catch(() => [] as CampusEvent[]),
      fetchConversationsAndMessages(),
      fetchPage('/notifications?limit=50')
        .then((rows) => rows.map((r) => mapApiNotification(r, currentUserId)))
        .catch(() => [] as NotificationItem[]),
      fetchApplications(currentUserId),
      fetchConnections(),
      fetchCommunities(currentUserId),
      fetchStartups(currentUserId),
    ]);

  return {
    users,
    projects,
    portfolio: [],
    communities,
    events,
    announcements: [],
    applications,
    connections,
    startups,
    conversations: convData.conversations,
    messages: convData.messages,
    notifications,
  };
}

/* ------------------------------ actions ---------------------------------- */

export async function liveCreateProject(
  data: Omit<Project, 'id' | 'createdAt' | 'ownerId' | 'currentTeam'>,
): Promise<Project> {
  const skillsNeeded = await resolveSkills(data.skillsRequired);
  const raw = await apiFetch<AnyRow>('/projects', {
    method: 'POST',
    body: {
      name: data.title,
      description: data.description,
      category: data.category,
      visibility: data.visibility,
      deadlineText: data.deadline,
      maxTeamSize: data.maxTeamSize,
      collaborationType: data.collaborationType,
      requirements: data.requirements,
      skillsNeeded,
    },
  });
  return mapApiProject(raw);
}

export async function liveApplyToProject(data: {
  projectId: string;
  roleApplied: string;
  message: string;
}): Promise<void> {
  const message = data.roleApplied
    ? `[${data.roleApplied}] ${data.message}`
    : data.message;
  await apiFetch(`/projects/${data.projectId}/join-requests`, {
    method: 'POST',
    body: { message },
  });
}

export async function liveAcceptProjectRequest(
  projectId: string,
  requestId: string,
): Promise<void> {
  await apiFetch(`/projects/${projectId}/join-requests/${requestId}/accept`, {
    method: 'PATCH',
  });
}

export async function liveRejectProjectRequest(
  projectId: string,
  requestId: string,
): Promise<void> {
  await apiFetch(`/projects/${projectId}/join-requests/${requestId}/reject`, {
    method: 'PATCH',
  });
}

export async function liveStartConversation(targetUserId: string): Promise<Conversation> {
  const raw = await apiFetch<AnyRow>('/conversations/direct', {
    method: 'POST',
    body: { userId: targetUserId },
  });
  const conv = mapApiConversation(raw);
  // Hydrate messages (openDirect may return an existing conversation)
  try {
    const rows = await fetchPage(`/conversations/${conv.id}/messages?limit=100`);
    conv.lastMessage = rows.length > 0 ? String(rows[rows.length - 1]!.body ?? '') : 'Conversation started';
  } catch {
    // keep placeholder
  }
  return conv;
}

export async function liveSendMessage(conversationId: string, text: string): Promise<Message> {
  // The schema expects { body: string } — a bare string body would be
  // rejected by body-parser's strict mode.
  const raw = await apiFetch<AnyRow>(`/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: { body: text },
  });
  return mapApiMessage(raw, conversationId);
}

export async function liveRsvpEvent(eventId: string): Promise<void> {
  await apiFetch(`/events/${eventId}/register`, { method: 'POST' });
}

export async function liveJoinCommunity(orgId: string): Promise<void> {
  await apiFetch(`/organizations/${orgId}/join`, { method: 'POST' });
}

export async function liveLeaveCommunity(orgId: string): Promise<void> {
  await apiFetch(`/organizations/${orgId}/leave`, { method: 'POST' });
}

export async function liveUpdateProfile(
  updates: Record<string, unknown>,
  skillNames: string[],
): Promise<void> {
  const body: Record<string, unknown> = {};
  if (typeof updates.name === 'string') body.fullName = updates.name;
  if (typeof updates.bio === 'string') body.bio = updates.bio;
  if (typeof updates.department === 'string') body.department = updates.department;
  // Profile picture — a base64 data URI persisted in the avatarUrl column
  // alongside the other profile details (fits the 2mb body limit: the
  // client downscales to a 256px square before upload)
  if (typeof updates.avatar === 'string' && updates.avatar.startsWith('data:image/')) {
    body.avatarUrl = updates.avatar;
  }
  await apiFetch('/users/me/profile', { method: 'PATCH', body });
  if (skillNames.length > 0) {
    const resolved = await resolveSkills(skillNames);
    for (const r of resolved) {
      await apiFetch('/users/me/skills', {
        method: 'POST',
        body: { skillId: r.skillId },
      }).catch(() => undefined);
    }
  }
}

export async function liveSendConnectionRequest(
  receiverId: string,
  message?: string,
): Promise<Connection> {
  const raw = await apiFetch<AnyRow>('/connections', {
    method: 'POST',
    body: { addresseeId: receiverId, ...(message ? { message } : {}) },
  });
  return mapApiConnection(raw);
}

export async function liveRespondToConnectionRequest(
  requestId: string,
  status: 'accepted' | 'declined',
): Promise<void> {
  await apiFetch(`/connections/${requestId}`, {
    method: 'PATCH',
    body: { status },
  });
}

export async function liveCancelConnectionRequest(requestId: string): Promise<void> {
  await apiFetch(`/connections/${requestId}`, { method: 'DELETE' });
}

export async function liveCreateStartup(data: {
  name: string;
  description?: string;
  logoUrl?: string;
  category?: string;
  industry?: string;
  stage?: string;
  websiteUrl?: string;
  hiring?: boolean;
}): Promise<unknown> {
  return apiFetch<AnyRow>('/organizations', {
    method: 'POST',
    body: {
      type: 'startup',
      name: data.name,
      description: data.description,
      logoUrl: data.logoUrl || undefined,
      category: data.category,
      startupDetails: {
        industry: data.industry,
        stage: data.stage,
        websiteUrl: data.websiteUrl,
        hiring: data.hiring,
      },
    },
  });
}

/** The UI's display statuses map back to the API's ProjectStatus enum —
 * 'Draft'/'Open'/'In Progress'/'Completed' are display labels, not enum
 * values (sending them raw fails validation). */
function mapC1StatusToApi(status: string): string {
  switch (status) {
    case 'Draft': return 'idea';
    case 'Open': return 'planning';
    case 'In Progress': return 'development';
    case 'Completed': return 'completed';
    default: return 'planning';
  }
}

export async function liveCreateNotice(data: {
  title: string;
  content: string;
  priority?: string;
}): Promise<unknown> {
  return apiFetch<AnyRow>('/notices', {
    method: 'POST',
    body: { ...data, priority: data.priority ?? 'Notice' },
  });
}

export async function liveUpdateProject(
  projectId: string,
  data: Record<string, unknown>,
  skillNames: string[],
): Promise<Project> {
  const skillsNeeded = await resolveSkills(skillNames);
  const { status, ...rest } = data;
  const body: Record<string, unknown> = {
    ...rest,
    ...(typeof status === 'string' ? { status: mapC1StatusToApi(status) } : {}),
    skillsNeeded,
  };
  const raw = await apiFetch<AnyRow>(`/projects/${projectId}`, {
    method: 'PATCH',
    body,
  });
  return mapApiProject(raw);
}

export async function liveDeleteProject(projectId: string): Promise<void> {
  await apiFetch(`/projects/${projectId}`, { method: 'DELETE' });
}

export async function liveLeaveProject(projectId: string): Promise<void> {
  await apiFetch(`/projects/${projectId}/leave`, { method: 'POST' });
}

export async function liveRemoveProjectMember(projectId: string, userId: string): Promise<void> {
  await apiFetch(`/projects/${projectId}/members/${userId}`, { method: 'DELETE' });
}

export async function liveMarkNotificationRead(id: string): Promise<void> {
  await apiFetch(`/notifications/${id}/read`, { method: 'PATCH' });
}

export async function liveMarkAllNotificationsRead(): Promise<void> {
  await apiFetch('/notifications/read-all', { method: 'PATCH' });
}

export async function liveMarkConversationRead(conversationId: string): Promise<void> {
  await apiFetch(`/conversations/${conversationId}/read`, { method: 'POST' });
}

/** SSE stream URL for a conversation — EventSource cannot send headers,
 * the API accepts the access token via ?token= (same verification as
 * requireAuth uses). */
export function conversationStreamUrl(conversationId: string, token: string): string {
  return `${API_BASE_URL}/conversations/${conversationId}/stream?token=${encodeURIComponent(token)}`;
}

/** Lightweight poll — merges fresh state without a full reload. Called
 * on an interval while the app is running in live mode. */
export async function livePoll(
  currentUserId: string,
  activeConversationId: string | null,
): Promise<{
  conversations: Conversation[];
  notifications: NotificationItem[];
  projects: Project[];
  events: CampusEvent[];
  activeMessages: Message[];
}> {
  const [convRows, notifRows, projRows, eventRows] = await Promise.all([
    fetchPage('/conversations?limit=50').catch(() => [] as AnyRow[]),
    fetchPage('/notifications?limit=50').catch(() => [] as AnyRow[]),
    fetchPage('/projects?limit=50').catch(() => [] as AnyRow[]),
    fetchPage('/events?limit=50').catch(() => [] as AnyRow[]),
  ]);

  let activeMessages: Message[] = [];
  if (activeConversationId) {
    try {
      const rows = await fetchPage(`/conversations/${activeConversationId}/messages?limit=100`);
      // API returns sentAt DESC — sort ascending for chronological display
      rows.sort(
        (a, b) => new Date(String(a.sentAt ?? 0)).getTime() - new Date(String(b.sentAt ?? 0)).getTime(),
      );
      activeMessages = rows.map((m) => mapApiMessage(m, activeConversationId));
    } catch {
      // stream/poll failure — keep empty, the UI keeps its current state
    }
  }

  return {
    conversations: convRows.map((c) => mapApiConversation(c)),
    notifications: notifRows.map((r) => mapApiNotification(r, currentUserId)),
    projects: projRows.map((r) => mapApiProject(r)),
    events: eventRows.map((r) => mapApiEvent(r, currentUserId)),
    activeMessages,
  };
}

export async function liveRefreshMe(): Promise<User | null> {
  try {
    const profile = await authApi.me();
    return mapApiUser(profile);
  } catch {
    return null;
  }
}

export { roleLabel };
