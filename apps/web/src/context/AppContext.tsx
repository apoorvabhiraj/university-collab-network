import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
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
  SavedItem,
  ActiveTab,
} from '../types';
import {
  INITIAL_USERS,
  INITIAL_PORTFOLIO,
  INITIAL_PROJECTS,
  INITIAL_COMMUNITIES,
  INITIAL_EVENTS,
  INITIAL_ANNOUNCEMENTS,
  INITIAL_CONVERSATIONS,
  INITIAL_MESSAGES,
  INITIAL_NOTIFICATIONS,
} from '../data/mockData';
import { useAuth } from './AuthContext';
import {
  fetchLiveBootstrap,
  liveCreateProject,
  liveApplyToProject,
  liveAcceptProjectRequest,
  liveRejectProjectRequest,
  liveStartConversation,
  liveSendMessage,
  liveRsvpEvent,
  liveJoinCommunity,
  liveLeaveCommunity,
  liveUpdateProfile,
  liveSendConnectionRequest,
  liveRespondToConnectionRequest,
  liveCancelConnectionRequest,
  liveUpdateProject,
  liveDeleteProject,
  liveLeaveProject,
  liveRemoveProjectMember,
  liveMarkNotificationRead,
  liveMarkAllNotificationsRead,
  liveMarkConversationRead,
  livePoll,
  conversationStreamUrl,
} from '../services/api/live';
import { mapApiMessage } from '../services/api/adapters';
import { getAccessToken } from '../services/api/session';

export interface Toast {
  message: string;
  kind: 'success' | 'error';
}

interface AppContextType {
  mode: 'live' | 'demo';
  isLoading: boolean;
  toast: Toast | null;
  showToast: (message: string, kind?: 'success' | 'error') => void;
  currentUser: User;
  users: User[];
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  globalSearch: string;
  setGlobalSearch: (s: string) => void;
  selectedUserId: string | null;
  setSelectedUserId: (id: string | null) => void;
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;
  selectedCommunityId: string | null;
  setSelectedCommunityId: (id: string | null) => void;
  openCommunityDetails: (communityId: string) => void;
  selectedEventId: string | null;
  setSelectedEventId: (id: string | null) => void;
  openEventDetails: (eventId: string) => void;
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;

  // Modals state
  isProjectCreateOpen: boolean;
  setIsProjectCreateOpen: (v: boolean) => void;
  isProjectEditOpen: boolean;
  setIsProjectEditOpen: (v: boolean) => void;
  isProfileEditOpen: boolean;
  setIsProfileEditOpen: (v: boolean) => void;
  isPortfolioAddOpen: boolean;
  setIsPortfolioAddOpen: (v: boolean) => void;
  isCollabModalOpen: boolean;
  setIsCollabModalOpen: (v: boolean) => void;
  collabTargetUser: User | null;
  setCollabTargetUser: (u: User | null) => void;
  isApplicationModalOpen: boolean;
  setIsApplicationModalOpen: (v: boolean) => void;
  applicationTargetProject: Project | null;
  setApplicationTargetProject: (p: Project | null) => void;

  // Data lists
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
  savedItems: SavedItem[];

  // Actions
  switchUser: (userId: string) => void;
  openUserProfile: (userId: string) => void;
  openProjectDetails: (projectId: string) => void;
  startConversationWithUser: (targetUserId: string) => void;
  sendMessage: (conversationId: string, text: string) => void;
  createProject: (data: Omit<Project, 'id' | 'createdAt' | 'ownerId' | 'currentTeam'>) => void;
  applyToProject: (data: { projectId: string; roleApplied: string; message: string; relevantSkills: string[]; portfolioLinks: string[]; proposedTimeline: string }) => void;
  handleApplicationStatus: (applicationId: string, status: 'Accepted' | 'Rejected' | 'Shortlisted') => void;
  sendConnectionRequest: (receiverId: string, message?: string) => void;
  respondToConnectionRequest: (requestId: string, status: 'accepted' | 'declined') => void;
  cancelConnectionRequest: (requestId: string) => void;
  updateProject: (projectId: string, updates: Partial<Project>) => void;
  deleteProject: (projectId: string) => void;
  leaveProject: (projectId: string) => void;
  removeProjectMember: (projectId: string, userId: string) => void;
  addPortfolioItem: (data: Omit<PortfolioItem, 'id' | 'userId'>) => void;
  updateUserProfile: (updates: Partial<User>) => void;
  toggleSaveItem: (itemType: SavedItem['itemType'], itemId: string) => void;
  isItemSaved: (itemType: SavedItem['itemType'], itemId: string) => boolean;
  toggleJoinCommunity: (communityId: string) => void;
  toggleRsvpEvent: (eventId: string) => void;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  createAnnouncement: (data: { title: string; content: string; priority: 'Urgent' | 'Important' | 'Notice' }) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

/** Minimal self user so the UI renders before the live bootstrap lands —
 * App.tsx shows a loading screen while isLoading; this is the belt to the
 * suspenders. */
const PLACEHOLDER_USER: User = {
  id: 'me',
  name: 'Loading…',
  username: 'loading',
  email: '',
  avatar: '',
  role: 'student',
  university: '',
  department: '',
  yearOrTitle: '',
  headline: '',
  bio: '',
  verification: { isVerified: false, badge: 'student', label: '' },
  availability: 'available',
  availabilityLabel: '',
  skills: [],
  collaborationInterests: [],
  links: {},
  stats: { completedProjects: 0, portfolioCount: 0, activeCollaborations: 0 },
};

function load<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    return saved ? (JSON.parse(saved) as T) : fallback;
  } catch {
    return fallback;
  }
}

export const AppProvider: React.FC<{ children: React.ReactNode; mode?: 'live' | 'demo' }> = ({
  children,
  mode: modeProp,
}) => {
  const { mode: authMode, liveUser, setLiveUser } = useAuth();
  const mode = modeProp ?? authMode;
  const isLive = mode === 'live';

  const [users, setUsers] = useState<User[]>(() =>
    isLive ? [] : load('ucn_users', INITIAL_USERS),
  );
  const [currentUserId, setCurrentUserId] = useState<string>(() =>
    isLive ? 'me' : localStorage.getItem('ucn_current_user_id') || 'u1',
  );

  const [activeTab, setActiveTabState] = useState<ActiveTab>('home');
  const [globalSearch, setGlobalSearch] = useState('');
  const [isLoading, setIsLoading] = useState<boolean>(isLive);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string, kind: 'success' | 'error' = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, kind });
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  };

  // Selected for modals or views
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    isLive ? null : 'conv1',
  );

  // Modal visibilities
  const [isProjectCreateOpen, setIsProjectCreateOpen] = useState(false);
  const [isProjectEditOpen, setIsProjectEditOpen] = useState(false);
  const [isProfileEditOpen, setIsProfileEditOpen] = useState(false);
  const [isPortfolioAddOpen, setIsPortfolioAddOpen] = useState(false);
  const [isCollabModalOpen, setIsCollabModalOpen] = useState(false);
  const [collabTargetUser, setCollabTargetUser] = useState<User | null>(null);
  const [isApplicationModalOpen, setIsApplicationModalOpen] = useState(false);
  const [applicationTargetProject, setApplicationTargetProject] = useState<Project | null>(null);

  // Data sets — demo mode restores from localStorage; live mode starts
  // empty and bootstraps from the API below. Client-side-only datasets
  // (portfolio, saved items, announcements) are session-scoped
  // in live mode: creations work but reloads start clean.
  const [projects, setProjects] = useState<Project[]>(() =>
    isLive ? [] : load('ucn_projects', INITIAL_PROJECTS),
  );
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>(() =>
    isLive ? [] : load('ucn_portfolio', INITIAL_PORTFOLIO),
  );
  const [communities, setCommunities] = useState<Community[]>(() =>
    isLive ? [] : load('ucn_communities', INITIAL_COMMUNITIES),
  );
  const [events, setEvents] = useState<CampusEvent[]>(() =>
    isLive ? [] : load('ucn_events', INITIAL_EVENTS),
  );
  const [announcements, setAnnouncements] = useState<CouncilAnnouncement[]>(() =>
    isLive ? [] : load('ucn_announcements', INITIAL_ANNOUNCEMENTS),
  );
  const [applications, setApplications] = useState<ProjectApplication[]>(() => {
    if (isLive) return [];
    const saved = localStorage.getItem('ucn_applications');
    return saved
      ? JSON.parse(saved)
      : [
          {
            id: 'app1',
            projectId: 'proj1',
            applicantId: 'u2',
            roleApplied: 'UI/UX Designer',
            message: 'Hey Alex! I have designed 4 hackathon-winning product flows and have a high-contrast component library ready for assistive device interactions.',
            relevantSkills: ['Figma', 'UI/UX Design', 'Tailwind CSS'],
            portfolioLinks: ['https://mayadesign.work'],
            proposedTimeline: 'Full availability for sprint & rehearsals',
            status: 'Submitted',
            submittedAt: '2026-09-15',
          },
        ];
  });
  const [startups, setStartups] = useState<Startup[]>(() =>
    isLive ? [] : load('ucn_startups', []),
  );
  const [connections, setConnections] = useState<Connection[]>(() => {
    if (isLive) return [];
    const saved = localStorage.getItem('ucn_connections_state');
    return saved
      ? JSON.parse(saved)
      : [
          { id: 'cr1', requesterId: 'u4', addresseeId: 'u1', status: 'pending', message: 'Interested in helping architect the PyTorch Geometric mini-batch worker pipeline for an upcoming workshop submission?', createdAt: '2026-09-18' },
          { id: 'cr2', requesterId: 'u2', addresseeId: 'u1', status: 'accepted', message: 'Loved your high-contrast component library work — let us connect.', createdAt: '2026-09-16' },
        ] as Connection[];
  });
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    isLive ? [] : load('ucn_conversations', INITIAL_CONVERSATIONS),
  );
  const [messages, setMessages] = useState<Message[]>(() =>
    isLive ? [] : load('ucn_messages', INITIAL_MESSAGES),
  );
  const [notifications, setNotifications] = useState<NotificationItem[]>(() =>
    isLive ? [] : load('ucn_notifications', INITIAL_NOTIFICATIONS),
  );
  const [savedItems, setSavedItems] = useState<SavedItem[]>(() =>
    isLive ? [] : load('ucn_saved_items', []),
  );

  const me = liveUser ?? PLACEHOLDER_USER;
  const demoCurrentUser = users.find((u) => u.id === currentUserId) || users[0] || PLACEHOLDER_USER;
  const currentUser = isLive ? me : demoCurrentUser;

  // ---- Live bootstrap: pull the platform's real state from the API ----
  useEffect(() => {
    if (!isLive) return;
    let cancelled = false;
    setIsLoading(true);
    fetchLiveBootstrap(me.id)
      .then((data) => {
        if (cancelled) return;
        setUsers(data.users);
        setProjects(data.projects);
        setPortfolio(data.portfolio);
        setCommunities(data.communities);
        setEvents(data.events);
        setAnnouncements(data.announcements);
        setApplications(data.applications);
        setConnections(data.connections);
        setStartups(data.startups);
        setConversations(data.conversations);
        setMessages(data.messages);
        setNotifications(data.notifications);
        setIsLoading(false);
      })
      .catch(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Bootstrap once per live session
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive]);

  // Auto-select the first conversation when it lands — the MessagesView
  // silently falls back to conversations[0] while activeConversationId is
  // null, but SSE + the poll only track the ACTIVE id, so messages in the
  // auto-fallback thread never rendered (they appeared in the sidebar but
  // not on screen until the next login).
  useEffect(() => {
    if (!isLive) return;
    if (activeConversationId === null && conversations.length > 0) {
      setActiveConversationId(conversations[0]!.id);
    }
  }, [isLive, activeConversationId, conversations]);

  // Mirror the active conversation id for interval/EventSource closures
  const activeConvIdRef = useRef<string | null>(activeConversationId);
  useEffect(() => {
    activeConvIdRef.current = activeConversationId;
  }, [activeConversationId]);

  // ---- Realtime: SSE stream for the active conversation (live mode) ----
  // The API pushes every new message via messageBus the moment it is sent —
  // no polling latency, no reload. Errors fall back to the interval poll.
  useEffect(() => {
    if (!isLive || !activeConversationId) return;
    const token = getAccessToken();
    if (!token) return;

    const es = new EventSource(conversationStreamUrl(activeConversationId, token));
    es.onmessage = (event) => {
      try {
        const raw = JSON.parse(event.data) as Record<string, unknown>;
        const msg = mapApiMessage(raw, activeConversationId);
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeConversationId
              ? { ...c, lastMessage: msg.text, lastMessageTimestamp: msg.timestamp }
              : c,
          ),
        );
      } catch {
        // ignore malformed events
      }
    };
    es.onerror = () => {
      // invalid/expired token or connection loss — close; the poll covers us
      es.close();
    };
    return () => {
      es.close();
    };
  }, [isLive, activeConversationId]);

  // Opening a conversation marks it read server-side (participant lastReadAt)
  useEffect(() => {
    if (!isLive || !activeConversationId) return;
    liveMarkConversationRead(activeConversationId).catch(() => undefined);
  }, [isLive, activeConversationId]);

  // ---- Live sync: interval poll keeps everything fresh while running ----
  // Conversations, notifications, projects and events re-merge every few
  // seconds (and the active thread as a fallback when SSE is down), so the
  // app updates in place instead of "each login".
  useEffect(() => {
    if (!isLive) return;
    const POLL_MS = 4000;
    const id = setInterval(() => {
      livePoll(me.id, activeConvIdRef.current)
        .then((data) => {
          setConversations(data.conversations);
          // preserve optimistic reads until the server confirms them
          setNotifications((prev) => {
            const readIds = new Set(prev.filter((n) => n.isRead).map((n) => n.id));
            return data.notifications.map((n) => ({ ...n, isRead: n.isRead || readIds.has(n.id) }));
          });
          setProjects(data.projects);
          setEvents(data.events);
          // connections (the auto-accepted message requests reflect live)
          setConnections(data.connections);
          setMessages((prev) => {
            // keep other threads' messages + in-flight optimistic ones;
            // replace only the active thread's slice with fresh data
            const active = activeConvIdRef.current;
            const others = prev.filter(
              (m) => m.conversationId !== active && !m.id.startsWith('msg_pending_'),
            );
            const pending = prev.filter((m) => m.id.startsWith('msg_pending_'));
            return [...others, ...data.activeMessages, ...pending];
          });
        })
        .catch(() => undefined);
    }, POLL_MS);
    return () => clearInterval(id);
    // me.id is stable for the session
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive]);

  // ---- localStorage sync — demo mode only for API-sourced datasets ----
  const sync = (key: string, value: unknown) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage full/unavailable — non-fatal
    }
  };

  useEffect(() => {
    if (!isLive) sync('ucn_users', users);
  }, [users, isLive]);
  useEffect(() => {
    if (!isLive) sync('ucn_projects', projects);
  }, [projects, isLive]);
  useEffect(() => {
    if (!isLive) sync('ucn_portfolio', portfolio);
  }, [portfolio, isLive]);
  useEffect(() => {
    if (!isLive) sync('ucn_communities', communities);
  }, [communities, isLive]);
  useEffect(() => {
    if (!isLive) sync('ucn_events', events);
  }, [events, isLive]);
  useEffect(() => {
    if (!isLive) sync('ucn_announcements', announcements);
  }, [announcements, isLive]);
  useEffect(() => {
    if (!isLive) sync('ucn_applications', applications);
  }, [applications, isLive]);
  useEffect(() => {
    if (!isLive) sync('ucn_connections_state', connections);
  }, [connections, isLive]);
  useEffect(() => {
    if (!isLive) sync('ucn_startups', startups);
  }, [startups, isLive]);
  useEffect(() => {
    if (!isLive) sync('ucn_conversations', conversations);
  }, [conversations, isLive]);
  useEffect(() => {
    if (!isLive) sync('ucn_messages', messages);
  }, [messages, isLive]);
  useEffect(() => {
    if (!isLive) sync('ucn_notifications', notifications);
  }, [notifications, isLive]);
  useEffect(() => {
    if (!isLive) sync('ucn_saved_items', savedItems);
  }, [savedItems, isLive]);
  useEffect(() => {
    if (!isLive) localStorage.setItem('ucn_current_user_id', currentUserId);
  }, [currentUserId, isLive]);

  const switchUser = (userId: string) => {
    if (isLive) return;
    setCurrentUserId(userId);
  };

  const setActiveTab = (tab: ActiveTab) => {
    setActiveTabState(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openUserProfile = (userId: string) => {
    setSelectedUserId(userId);
  };

  const openProjectDetails = (projectId: string) => {
    setSelectedProjectId(projectId);
  };

  const openCommunityDetails = (communityId: string) => {
    setSelectedCommunityId(communityId);
  };

  const openEventDetails = (eventId: string) => {
    setSelectedEventId(eventId);
  };

  const startConversationWithUser = (targetUserId: string) => {
    if (targetUserId === currentUser.id) return;
    if (isLive) {
      liveStartConversation(targetUserId)
        .then((conv) => {
          setConversations((prev) => {
            const existing = prev.findIndex((c) => c.id === conv.id);
            if (existing >= 0) {
              const next = [...prev];
              next[existing] = conv;
              return next;
            }
            return [conv, ...prev];
          });
          setActiveConversationId(conv.id);
          setActiveTab('messages');
        })
        .catch((err) => {
          const msg =
            err && typeof err === 'object' && 'message' in err && (err as Error).message
              ? (err as Error).message
              : 'Could not start the conversation.';
          showToast(msg, 'error');
        });
      return;
    }

    const existing = conversations.find(
      (c) => c.participantIds.includes(currentUser.id) && c.participantIds.includes(targetUserId)
    );

    if (existing) {
      setActiveConversationId(existing.id);
    } else {
      const newConvId = `conv_${Date.now()}`;
      const newConv: Conversation = {
        id: newConvId,
        participantIds: [currentUser.id, targetUserId],
        lastMessage: 'Conversation started',
        lastMessageTimestamp: 'Just now',
        unreadCount: 0,
      };
      setConversations((prev) => [newConv, ...prev]);
      setActiveConversationId(newConvId);
    }
    setActiveTab('messages');
  };

  const sendMessage = (conversationId: string, text: string) => {
    if (!text.trim()) return;

    if (isLive) {
      const optimistic: Message = {
        id: `msg_pending_${Date.now()}`,
        conversationId,
        senderId: currentUser.id,
        text: text.trim(),
        timestamp: 'Just now',
      };
      setMessages((prev) => [...prev, optimistic]);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId ? { ...c, lastMessage: text.trim(), lastMessageTimestamp: 'Just now' } : c,
        ),
      );
      liveSendMessage(conversationId, text.trim())
        .then((saved) => {
          // The SSE stream may have already delivered this message (the bus
          // publishes before the send response returns) — dedupe by id.
          setMessages((prev) => {
            const rest = prev.filter((m) => m.id !== optimistic.id);
            return rest.some((m) => m.id === saved.id) ? rest : [...rest, saved];
          });
        })
        .catch(() => {
          setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
          showToast('Message could not be delivered.', 'error');
        });
      return;
    }

    const newMsg: Message = {
      id: `msg_${Date.now()}`,
      conversationId,
      senderId: currentUser.id,
      text: text.trim(),
      timestamp: 'Just now',
    };

    setMessages((prev) => [...prev, newMsg]);

    setConversations((prev) =>
      prev.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              lastMessage: text.trim(),
              lastMessageTimestamp: 'Just now',
            }
          : c
      )
    );

    // Optional simulated reply for testing interactive messaging
    const conv = conversations.find((c) => c.id === conversationId);
    if (conv) {
      const otherUserId = conv.participantIds.find((id) => id !== currentUser.id);
      const otherUser = users.find((u) => u.id === otherUserId);
      if (otherUser) {
        setTimeout(() => {
          const replyText =
            otherUser.role === 'professor'
              ? `Thanks for your message! Please drop by my office hours or send your resume/GitHub so we can evaluate your fit for the lab.`
              : `Hey! Thanks for reaching out regarding collaboration. Let's sync up over campus coffee or on our project channel!`;

          const autoReply: Message = {
            id: `msg_reply_${Date.now()}`,
            conversationId,
            senderId: otherUser.id,
            text: replyText,
            timestamp: 'Just now',
          };
          setMessages((prev) => [...prev, autoReply]);
          setConversations((prev) =>
            prev.map((c) =>
              c.id === conversationId
                ? {
                    ...c,
                    lastMessage: replyText,
                    lastMessageTimestamp: 'Just now',
                  }
                : c
            )
          );
        }, 1500);
      }
    }
  };

  const createProject = (data: Omit<Project, 'id' | 'createdAt' | 'ownerId' | 'currentTeam'>) => {
    if (isLive) {
      liveCreateProject(data)
        .then((created) => {
          setProjects((prev) => [created, ...prev]);
          const newNotif: NotificationItem = {
            id: `notif_${Date.now()}`,
            userId: currentUser.id,
            type: 'system',
            title: 'Project Published',
            description: `Your project "${data.title}" is now open for collaborators.`,
            timestamp: 'Just now',
            isRead: false,
            linkTab: 'projects',
            referenceId: created.id,
          };
          setNotifications((prev) => [newNotif, ...prev]);
          showToast('Project published to the network.');
        })
        .catch(() => showToast('Could not publish the project. Is the API running?', 'error'));
      return;
    }

    const newProject: Project = {
      ...data,
      id: `proj_${Date.now()}`,
      ownerId: currentUser.id,
      currentTeam: [{ userId: currentUser.id, role: 'Project Lead' }],
      createdAt: new Date().toISOString().split('T')[0],
    };

    setProjects((prev) => [newProject, ...prev]);

    // Add notification
    const newNotif: NotificationItem = {
      id: `notif_${Date.now()}`,
      userId: currentUser.id,
      type: 'system',
      title: 'Project Published',
      description: `Your project "${data.title}" is now open for collaborators.`,
      timestamp: 'Just now',
      isRead: false,
      linkTab: 'projects',
      referenceId: newProject.id,
    };
    setNotifications((prev) => [newNotif, ...prev]);
  };

  const applyToProject = (data: {
    projectId: string;
    roleApplied: string;
    message: string;
    relevantSkills: string[];
    portfolioLinks: string[];
    proposedTimeline: string;
  }) => {
    if (isLive) {
      liveApplyToProject(data)
        .then(() => showToast('Application submitted.'))
        .catch(() => showToast('Could not submit the application.', 'error'));
      return;
    }

    const newApplication: ProjectApplication = {
      id: `app_${Date.now()}`,
      ...data,
      applicantId: currentUser.id,
      status: 'Submitted',
      submittedAt: new Date().toISOString().split('T')[0],
    };

    setApplications((prev) => [newApplication, ...prev]);

    const targetProj = projects.find((p) => p.id === data.projectId);
    if (targetProj) {
      const notif: NotificationItem = {
        id: `notif_app_${Date.now()}`,
        userId: targetProj.ownerId,
        type: 'application',
        title: 'New Project Proposal',
        description: `${currentUser.name} applied for "${data.roleApplied}" on ${targetProj.title}.`,
        timestamp: 'Just now',
        isRead: false,
        linkTab: 'dashboard',
        referenceId: targetProj.id,
      };
      setNotifications((prev) => [notif, ...prev]);
    }
  };

  const handleApplicationStatus = (
    applicationId: string,
    status: 'Accepted' | 'Rejected' | 'Shortlisted'
  ) => {
    if (isLive) {
      const app = applications.find((a) => a.id === applicationId);
      setApplications((prev) =>
        prev.map((a) => (a.id === applicationId ? { ...a, status: status === 'Shortlisted' ? 'Submitted' : status } : a)),
      );
      if (app && status !== 'Shortlisted') {
        (status === 'Accepted' ? liveAcceptProjectRequest(app.projectId, app.id) : liveRejectProjectRequest(app.projectId, app.id))
          .then(() => {
            if (status === 'Accepted') {
              // Acceptance creates the real membership server-side — mirror it locally
              setProjects((prev) =>
                prev.map((p) => {
                  if (p.id === app.projectId) {
                    const alreadyIn = p.currentTeam.some((m) => m.userId === app.applicantId);
                    if (!alreadyIn) {
                      return {
                        ...p,
                        currentTeam: [...p.currentTeam, { userId: app.applicantId, role: app.roleApplied }],
                      };
                    }
                  }
                  return p;
                }),
              );
            }
            showToast(`Application ${status.toLowerCase()}.`);
          })
          .catch(() => showToast('Could not update the application.', 'error'));
      }
      return;
    }

    setApplications((prev) =>
      prev.map((app) => (app.id === applicationId ? { ...app, status } : app))
    );

    const app = applications.find((a) => a.id === applicationId);
    if (app && status === 'Accepted') {
      // Add user to project team
      setProjects((prev) =>
        prev.map((p) => {
          if (p.id === app.projectId) {
            const alreadyIn = p.currentTeam.some((m) => m.userId === app.applicantId);
            if (!alreadyIn) {
              return {
                ...p,
                currentTeam: [...p.currentTeam, { userId: app.applicantId, role: app.roleApplied }],
              };
            }
          }
          return p;
        })
      );

      // Notify applicant
      const notif: NotificationItem = {
        id: `notif_acc_${Date.now()}`,
        userId: app.applicantId,
        type: 'application',
        title: 'Proposal Accepted!',
        description: `Your application for "${app.roleApplied}" has been accepted. You are now part of the team!`,
        timestamp: 'Just now',
        isRead: false,
        linkTab: 'dashboard',
      };
      setNotifications((prev) => [notif, ...prev]);
    }
  };

  /** Professional connection request — SEPARATE from project collaboration.
   * The API enforces the 3-requests/week rate limit and one pending request
   * per pair; declined pairs can re-request (the history remains). */
  const sendConnectionRequest = (receiverId: string, message?: string) => {
    if (receiverId === currentUser.id) return;
    if (isLive) {
      liveSendConnectionRequest(receiverId, message)
        .then((created) => {
          setConnections((prev) => {
            const existing = prev.findIndex((c) => c.id === created.id);
            if (existing >= 0) {
              const next = [...prev];
              next[existing] = created;
              return next;
            }
            return [created, ...prev];
          });
          showToast('Connection request sent.');
        })
        .catch((err) => {
          const msg =
            err && typeof err === 'object' && 'message' in err && (err as Error).message
              ? (err as Error).message
              : 'Could not send the request.';
          showToast(msg, 'error');
        });
      return;
    }

    const newConn: Connection = {
      id: `cr_${Date.now()}`,
      requesterId: currentUser.id,
      addresseeId: receiverId,
      status: 'pending',
      message: message ?? '',
      createdAt: new Date().toISOString().split('T')[0],
    };
    setConnections((prev) => [newConn, ...prev]);

    const notif: NotificationItem = {
      id: `notif_cr_${Date.now()}`,
      userId: receiverId,
      type: 'collab_request',
      title: 'Connection Request',
      description: `${currentUser.name} wants to connect with you.`,
      timestamp: 'Just now',
      isRead: false,
      linkTab: 'dashboard',
    };
    setNotifications((prev) => [notif, ...prev]);
  };

  const respondToConnectionRequest = (requestId: string, status: 'accepted' | 'declined') => {
    if (isLive) {
      setConnections((prev) =>
        prev.map((c) => (c.id === requestId ? { ...c, status } : c)),
      );
      liveRespondToConnectionRequest(requestId, status)
        .then(() => showToast(status === 'accepted' ? 'You are now connected.' : 'Request declined.'))
        .catch(() => showToast('Could not update the request.', 'error'));
      return;
    }

    setConnections((prev) =>
      prev.map((c) => (c.id === requestId ? { ...c, status } : c))
    );

    const conn = connections.find((c) => c.id === requestId);
    if (conn) {
      const notif: NotificationItem = {
        id: `notif_cr_status_${Date.now()}`,
        userId: conn.requesterId,
        type: 'collab_request',
        title: status === 'accepted' ? 'Connection Accepted' : 'Connection Declined',
        description: `${currentUser.name} has ${status} your connection request.`,
        timestamp: 'Just now',
        isRead: false,
        linkTab: 'dashboard',
      };
      setNotifications((prev) => [notif, ...prev]);
    }
  };

  const cancelConnectionRequest = (requestId: string) => {
    if (isLive) {
      setConnections((prev) => prev.filter((c) => c.id !== requestId));
      liveCancelConnectionRequest(requestId)
        .then(() => showToast('Request cancelled.'))
        .catch(() => showToast('Could not cancel the request.', 'error'));
      return;
    }
    setConnections((prev) => prev.filter((c) => c.id !== requestId));
  };

  const updateProject = (projectId: string, updates: Partial<Project>) => {
    if (isLive) {
      liveUpdateProject(projectId, updates as Record<string, unknown>, updates.skillsRequired ?? [])
        .then((updated) => {
          setProjects((prev) => prev.map((p) => (p.id === projectId ? updated : p)));
          showToast('Project updated.');
        })
        .catch((err) => {
          const msg =
            err && typeof err === 'object' && 'message' in err && (err as Error).message
              ? (err as Error).message
              : 'Could not update the project.';
          showToast(msg, 'error');
        });
      return;
    }
    setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, ...updates } : p)));
  };

  const deleteProject = (projectId: string) => {
    if (isLive) {
      // DELETE archives the project server-side (deactivate through the
      // backend, not merely hide it in the UI)
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      liveDeleteProject(projectId)
        .then(() => showToast('Project deleted.'))
        .catch((err) => {
          const msg =
            err && typeof err === 'object' && 'message' in err && (err as Error).message
              ? (err as Error).message
              : 'Could not delete the project.';
          showToast(msg, 'error');
        });
      return;
    }
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
  };

  const leaveProject = (projectId: string) => {
    if (isLive) {
      // The project stays intact — only this member's membership is removed
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? { ...p, currentTeam: p.currentTeam.filter((m) => m.userId !== currentUser.id) }
            : p,
        ),
      );
      liveLeaveProject(projectId)
        .then(() => showToast('You have left the project.'))
        .catch((err) => {
          const msg =
            err && typeof err === 'object' && 'message' in err && (err as Error).message
              ? (err as Error).message
              : 'Could not leave the project.';
          showToast(msg, 'error');
        });
      return;
    }
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? { ...p, currentTeam: p.currentTeam.filter((m) => m.userId !== currentUser.id) }
          : p,
      ),
    );
  };

  const removeProjectMember = (projectId: string, userId: string) => {
    if (isLive) {
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? { ...p, currentTeam: p.currentTeam.filter((m) => m.userId !== userId) }
            : p,
        ),
      );
      liveRemoveProjectMember(projectId, userId)
        .then(() => showToast('Teammate removed.'))
        .catch((err) => {
          const msg =
            err && typeof err === 'object' && 'message' in err && (err as Error).message
              ? (err as Error).message
              : 'Could not remove the teammate.';
          showToast(msg, 'error');
        });
      return;
    }
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? { ...p, currentTeam: p.currentTeam.filter((m) => m.userId !== userId) }
          : p,
      ),
    );
  };

  const addPortfolioItem = (data: Omit<PortfolioItem, 'id' | 'userId'>) => {
    // Portfolio items are a Campus-UI (client-side) feature — the live API's
    // portfolio is a derived view over projects/teams/publications.
    const newItem: PortfolioItem = {
      ...data,
      id: `port_${Date.now()}`,
      userId: currentUser.id,
    };

    setPortfolio((prev) => [newItem, ...prev]);
    const bumpStats = (u: User): User => ({
      ...u,
      stats: { ...u.stats, portfolioCount: u.stats.portfolioCount + 1 },
    });
    if (isLive) {
      if (liveUser) setLiveUser(bumpStats(liveUser));
    } else {
      setUsers((prev) => prev.map((u) => (u.id === currentUser.id ? bumpStats(u) : u)));
    }
  };

  const updateUserProfile = (updates: Partial<User>) => {
    if (isLive) {
      if (liveUser) setLiveUser({ ...liveUser, ...updates });
      const skillNames = updates.skills ?? [];
      liveUpdateProfile(updates as Record<string, unknown>, skillNames)
        .then(() => showToast('Profile updated.'))
        .catch(() => showToast('Could not save profile changes to the server.', 'error'));
      return;
    }

    setUsers((prev) =>
      prev.map((u) => (u.id === currentUser.id ? { ...u, ...updates } : u))
    );
  };

  const toggleSaveItem = (itemType: SavedItem['itemType'], itemId: string) => {
    setSavedItems((prev) => {
      const existing = prev.find(
        (s) => s.userId === currentUser.id && s.itemType === itemType && s.itemId === itemId
      );
      if (existing) {
        return prev.filter((s) => s.id !== existing.id);
      } else {
        return [
          {
            id: `save_${Date.now()}`,
            userId: currentUser.id,
            itemType,
            itemId,
            savedAt: new Date().toISOString().split('T')[0],
          },
          ...prev,
        ];
      }
    });
  };

  const isItemSaved = (itemType: SavedItem['itemType'], itemId: string): boolean => {
    return savedItems.some(
      (s) => s.userId === currentUser.id && s.itemType === itemType && s.itemId === itemId
    );
  };

  const toggleJoinCommunity = (communityId: string) => {
    if (isLive) {
      const community = communities.find((c) => c.id === communityId);
      const isMember = !!community?.isJoined;
      setCommunities((prev) =>
        prev.map((c) => {
          if (c.id === communityId) {
            return {
              ...c,
              isJoined: !isMember,
              memberCount: isMember ? Math.max(0, c.memberCount - 1) : c.memberCount + 1,
              members: isMember
                ? c.members.filter((id) => id !== currentUser.id)
                : [...c.members, currentUser.id],
            };
          }
          return c;
        }),
      );
      (isMember ? liveLeaveCommunity(communityId) : liveJoinCommunity(communityId))
        .then(() => showToast(isMember ? 'Left the community.' : 'Joined the community.'))
        .catch(() => showToast('Could not update membership.', 'error'));
      return;
    }

    setCommunities((prev) =>
      prev.map((c) => {
        if (c.id === communityId) {
          const isMember = c.members.includes(currentUser.id);
          const newMembers = isMember
            ? c.members.filter((id) => id !== currentUser.id)
            : [...c.members, currentUser.id];
          return {
            ...c,
            members: newMembers,
            memberCount: isMember ? c.memberCount - 1 : c.memberCount + 1,
            isJoined: !isMember,
          };
        }
        return c;
      })
    );
  };

  const toggleRsvpEvent = (eventId: string) => {
    if (isLive) {
      const target = events.find((ev) => ev.id === eventId);
      const wasRegistered = !!target?.isRegistered;
      setEvents((prev) =>
        prev.map((ev) => {
          if (ev.id === eventId) {
            return {
              ...ev,
              isRegistered: !wasRegistered,
              registeredCount: wasRegistered ? Math.max(0, ev.registeredCount - 1) : ev.registeredCount + 1,
            };
          }
          return ev;
        }),
      );
      // The API exposes register (no unregister) — registering syncs
      // server-side; unregistering is client-side only.
      if (!wasRegistered) {
        liveRsvpEvent(eventId)
          .then(() => showToast('You are registered.'))
          .catch(() => showToast('Could not register. Is the API running?', 'error'));
      }
      return;
    }

    setEvents((prev) =>
      prev.map((ev) => {
        if (ev.id === eventId) {
          const wasRegistered = !!ev.isRegistered;
          return {
            ...ev,
            isRegistered: !wasRegistered,
            registeredCount: wasRegistered ? ev.registeredCount - 1 : ev.registeredCount + 1,
          };
        }
        return ev;
      })
    );
  };

  const markNotificationAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    if (isLive) {
      liveMarkNotificationRead(id).catch(() => undefined);
    }
  };

  const markAllNotificationsAsRead = () => {
    setNotifications((prev) =>
      prev.map((n) => (n.userId === currentUser.id ? { ...n, isRead: true } : n))
    );
    if (isLive) {
      liveMarkAllNotificationsRead().catch(() => undefined);
    }
  };

  const createAnnouncement = (data: {
    title: string;
    content: string;
    priority: 'Urgent' | 'Important' | 'Notice';
  }) => {
    // Council announcements are a Campus-UI (client-side) feature.
    const newAnnouncement: CouncilAnnouncement = {
      id: `ann_${Date.now()}`,
      title: data.title,
      author: currentUser.name,
      authorRole: currentUser.yearOrTitle,
      department: currentUser.department,
      date: 'Just now',
      content: data.content,
      priority: data.priority,
      isPinned: data.priority === 'Urgent',
    };

    setAnnouncements((prev) => [newAnnouncement, ...prev]);

    if (isLive) {
      setNotifications((prev) => [
        {
          id: `notif_ann_${Date.now()}`,
          userId: currentUser.id,
          type: 'announcement',
          title: `University Council Notice: ${data.title}`,
          description: data.content.slice(0, 80) + '...',
          timestamp: 'Just now',
          isRead: false,
          linkTab: 'announcements',
        },
        ...prev,
      ]);
      return;
    }

    // Broadcast notification to all active users
    users.forEach((u) => {
      const notif: NotificationItem = {
        id: `notif_ann_${Date.now()}_${u.id}`,
        userId: u.id,
        type: 'announcement',
        title: `University Council Notice: ${data.title}`,
        description: data.content.slice(0, 80) + '...',
        timestamp: 'Just now',
        isRead: false,
        linkTab: 'announcements',
      };
      setNotifications((prev) => [notif, ...prev]);
    });
  };

  return (
    <AppContext.Provider
      value={{
        mode,
        isLoading,
        toast,
        showToast,
        currentUser,
        users,
        activeTab,
        setActiveTab,
        globalSearch,
        setGlobalSearch,
        selectedUserId,
        setSelectedUserId,
        selectedProjectId,
        setSelectedProjectId,
        selectedCommunityId,
        setSelectedCommunityId,
        openCommunityDetails,
        selectedEventId,
        setSelectedEventId,
        openEventDetails,
        activeConversationId,
        setActiveConversationId,
        isProjectCreateOpen,
        setIsProjectCreateOpen,
        isProjectEditOpen,
        setIsProjectEditOpen,
        isProfileEditOpen,
        setIsProfileEditOpen,
        isPortfolioAddOpen,
        setIsPortfolioAddOpen,
        isCollabModalOpen,
        setIsCollabModalOpen,
        collabTargetUser,
        setCollabTargetUser,
        isApplicationModalOpen,
        setIsApplicationModalOpen,
        applicationTargetProject,
        setApplicationTargetProject,
        projects,
        portfolio,
        communities,
        events,
        announcements,
        applications,
        connections,
        startups,
        conversations,
        messages,
        notifications,
        savedItems,
        switchUser,
        openUserProfile,
        openProjectDetails,
        startConversationWithUser,
        sendMessage,
        createProject,
        applyToProject,
        handleApplicationStatus,
        sendConnectionRequest,
        respondToConnectionRequest,
        cancelConnectionRequest,
        updateProject,
        deleteProject,
        leaveProject,
        removeProjectMember,
        addPortfolioItem,
        updateUserProfile,
        toggleSaveItem,
        isItemSaved,
        toggleJoinCommunity,
        toggleRsvpEvent,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        createAnnouncement,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
