import { Router } from "express";
import { healthRouter } from "./health.routes.js";
import { testRouter } from "./test.routes.js";
import { authRouter } from "./auth.routes.js";
import { usersRouter } from "./users.routes.js";
import { researchTopicsRouter } from "./researchTopics.routes.js";
import { organizationsRouter } from "./organizations.routes.js";
import { researchTeamsRouter } from "./researchTeams.routes.js";
import { publicationsRouter } from "./publications.routes.js";
import { projectsRouter } from "./projects.routes.js";
import { skillsRouter } from "./skills.routes.js";
import { eventsRouter } from "./events.routes.js";
import { opportunitiesRouter } from "./opportunities.routes.js";
import { connectionsRouter } from "./connections.routes.js";
import { conversationsRouter } from "./conversations.routes.js";
import { groupsRouter } from "./groups.routes.js";
import { notificationsRouter } from "./notifications.routes.js";
import { searchRouter } from "./search.routes.js";
import { discoverRouter } from "./discover.routes.js";
import { adminRouter } from "./admin.routes.js";

const apiV1Router = Router();

// Auth routes (Phase 4)
apiV1Router.use("/auth", authRouter);

// Phase 5 — Profile & Privacy (API_CONTRACT.md §2)
apiV1Router.use("/users", usersRouter);

// Phase 5 — Resource groups (API_CONTRACT.md §3)
apiV1Router.use("/research-topics", researchTopicsRouter);
apiV1Router.use("/organizations", organizationsRouter);
apiV1Router.use("/research-teams", researchTeamsRouter);
apiV1Router.use("/publications", publicationsRouter);
apiV1Router.use("/projects", projectsRouter);
apiV1Router.use("/skills", skillsRouter);
apiV1Router.use("/events", eventsRouter);
apiV1Router.use("/opportunities", opportunitiesRouter);

// Phase 5 — Search, Connections/Messaging, Notifications, Discover, Admin (§4, §6, §7, §8, §9)
apiV1Router.use("/search", searchRouter);
apiV1Router.use("/connections", connectionsRouter);
apiV1Router.use("/conversations", conversationsRouter);
apiV1Router.use("/groups", groupsRouter);
apiV1Router.use("/notifications", notificationsRouter);
apiV1Router.use("/discover", discoverRouter);
apiV1Router.use("/admin", adminRouter);

// Test & diagnostics routes (dev/test only)
if (process.env.NODE_ENV !== "production") {
  // Deliberate-error test routes — development only (spec §6: production
  // debug endpoints must be unavailable to unauthorized users)
  if (process.env.NODE_ENV !== "production") {
    apiV1Router.use("/test", testRouter);
  }
}

export { apiV1Router, healthRouter };
