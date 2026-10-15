import { createBrowserRouter } from "react-router-dom";
import AuthLayout from "@/layouts/AuthLayout";
import AppLayout from "@/layouts/AppLayout";
import ProtectedRoute from "./ProtectedRoute";
import LandingPage from "@/pages/landing/LandingPage";
import LoginPage from "@/pages/auth/LoginPage";
import SignupPage from "@/pages/auth/SignupPage";
import DashboardPage from "@/pages/dashboard/DashboardPage";
import DiscoverPage from "@/pages/discover/DiscoverPage";
import NetworkPage from "@/pages/network/NetworkPage";
import StudentsListPage from "@/pages/students/StudentsListPage";
import StudentDetailPage from "@/pages/students/StudentDetailPage";
import ProfessorsListPage from "@/pages/professors/ProfessorsListPage";
import ProfessorDetailPage from "@/pages/professors/ProfessorDetailPage";
import ResearchersListPage from "@/pages/researchers/ResearchersListPage";
import ResearcherDetailPage from "@/pages/researchers/ResearcherDetailPage";
import ProjectsListPage from "@/pages/projects/ProjectsListPage";
import ProjectDetailPage from "@/pages/projects/ProjectDetailPage";
import EventsListPage from "@/pages/events/EventsListPage";
import EventDetailPage from "@/pages/events/EventDetailPage";
import OpportunitiesListPage from "@/pages/opportunities/OpportunitiesListPage";
import OpportunityDetailPage from "@/pages/opportunities/OpportunityDetailPage";
import PublicationsListPage from "@/pages/publications/PublicationsListPage";
import PublicationDetailPage from "@/pages/publications/PublicationDetailPage";
import ResearchListPage from "@/pages/research/ResearchListPage";
import ResearchTopicDetailPage from "@/pages/research/ResearchTopicDetailPage";
import ResearchTeamsListPage from "@/pages/research-teams/ResearchTeamsListPage";
import ResearchTeamDetailPage from "@/pages/research-teams/ResearchTeamDetailPage";
import ClubsListPage from "@/pages/clubs/ClubsListPage";
import ClubDetailPage from "@/pages/clubs/ClubDetailPage";
import StartupsListPage from "@/pages/startups/StartupsListPage";
import StartupDetailPage from "@/pages/startups/StartupDetailPage";
import AdminPage from "@/pages/admin/AdminPage";
import MessagesPage from "@/pages/messages/MessagesPage";
import NotificationsPage from "@/pages/notifications/NotificationsPage";
import SettingsPage from "@/pages/settings/SettingsPage";
import MyPortfolioPage from "@/pages/me/MyPortfolioPage";
import MyProjectsPage from "@/pages/me/MyProjectsPage";
import OnboardingPage from "@/pages/onboarding/OnboardingPage";
import JoinGroupPage from "@/pages/groups/JoinGroupPage";
import TermsPage from "@/pages/legal/TermsPage";
import PrivacyPage from "@/pages/legal/PrivacyPage";

// Router skeleton (Phase 6) + Phase 7 route wiring. Full route map lives in
// FILE_STRUCTURE.md's "Route → Owning Phase Map" — routes not listed below
// (research, research-teams, projects, publications, clubs, startups,
// events, opportunities, admin) are not built yet; see
// IMPLEMENTATION_STATUS.md's Phase 7 session note for exactly what's done
// vs. remaining. Adding entries here as pages are built is Phase 7's job;
// the layouts/ProtectedRoute structure itself is Phase 6's.
export const router = createBrowserRouter([
  {
    path: "/",
    element: <LandingPage />,
  },
  {
    element: <AuthLayout />,
    children: [
      { path: "/login", element: <LoginPage /> },
      { path: "/signup", element: <SignupPage /> },
    ],
  },
  { path: "/groups/join/:token", element: <JoinGroupPage /> },
  { path: "/terms", element: <TermsPage /> },
  { path: "/privacy", element: <PrivacyPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: "/dashboard", element: <DashboardPage /> },
          { path: "/discover", element: <DiscoverPage /> },
          { path: "/network", element: <NetworkPage /> },
          { path: "/students", element: <StudentsListPage /> },
          { path: "/students/:username", element: <StudentDetailPage /> },
          { path: "/professors", element: <ProfessorsListPage /> },
          { path: "/professors/:username", element: <ProfessorDetailPage /> },
          { path: "/researchers", element: <ResearchersListPage /> },
          { path: "/researchers/:username", element: <ResearcherDetailPage /> },
          { path: "/projects", element: <ProjectsListPage /> },
          { path: "/projects/:id", element: <ProjectDetailPage /> },
          { path: "/events", element: <EventsListPage /> },
          { path: "/events/:id", element: <EventDetailPage /> },
          { path: "/opportunities", element: <OpportunitiesListPage /> },
          { path: "/opportunities/:id", element: <OpportunityDetailPage /> },
          { path: "/publications", element: <PublicationsListPage /> },
          { path: "/publications/:id", element: <PublicationDetailPage /> },
          { path: "/research", element: <ResearchListPage /> },
          { path: "/research/:topic", element: <ResearchTopicDetailPage /> },
          { path: "/research-teams", element: <ResearchTeamsListPage /> },
          { path: "/research-teams/:id", element: <ResearchTeamDetailPage /> },
          { path: "/clubs", element: <ClubsListPage /> },
          { path: "/clubs/:id", element: <ClubDetailPage /> },
          { path: "/startups", element: <StartupsListPage /> },
          { path: "/startups/:id", element: <StartupDetailPage /> },
          { path: "/admin", element: <AdminPage /> },
          { path: "/messages", element: <MessagesPage /> },
          { path: "/notifications", element: <NotificationsPage /> },
          { path: "/settings", element: <SettingsPage /> },
          { path: "/me", element: <MyPortfolioPage /> },
          { path: "/my-projects", element: <MyProjectsPage /> },
          { path: "/onboarding", element: <OnboardingPage /> },
        ],
      },
    ],
  },
]);
