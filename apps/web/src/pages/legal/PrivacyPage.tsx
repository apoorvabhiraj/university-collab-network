import { Link } from "react-router-dom";
import { LegalPageShell } from "./LegalPageShell";

export default function PrivacyPage(): JSX.Element {
  return (
    <LegalPageShell title="Privacy Policy" lastUpdated="October 16, 2026">
      <p>
        This Privacy Policy explains what the University Collaboration Network ("UCN", "the
        platform") collects, how it uses your information, and the controls you have. It reflects
        the platform's actual, server-enforced privacy model.
      </p>

      <h2>1. Information we collect</h2>
      <ul>
        <li>
          <strong>Account information</strong>: email address, server-generated username, password
          (stored only as a bcrypt hash), full name, declared status (Student, Faculty,
          Researcher, Professional, or Alumni), university email domain.
        </li>
        <li>
          <strong>Profile information</strong>: department, course/degree, year, university, bio,
          CGPA (students, optional), designation and expertise (faculty), research areas and
          current availability (researchers), organization and job title (professionals), avatar,
          and social/portfolio links.
        </li>
        <li>
          <strong>Collaboration information</strong>: projects you create or join, research teams,
          publications, group memberships, skills, and research interests.
        </li>
        <li>
          <strong>Communication</strong>: messages you send, conversation participation, and
          collaboration requests/invitations you send or receive.
        </li>
        <li>
          <strong>Onboarding context</strong>: your goals (e.g. find collaborators, research
          opportunities) and selected skills/interests, used to personalize discovery.
        </li>
        <li>
          <strong>Technical data</strong>: server logs (request method and URL — with query
          strings stripped), response codes, and timestamps.
        </li>
      </ul>

      <h2>2. What we do NOT collect</h2>
      <ul>
        <li>We do not collect payment information.</li>
        <li>We do not use third-party advertising or tracking pixels.</li>
        <li>We do not sell your personal information to anyone.</li>
        <li>Passwords are never stored in readable form or logged.</li>
      </ul>

      <h2>3. Visibility controls (server-enforced)</h2>
      <p>
        Every profile field group has a visibility setting you control in{" "}
        <Link to="/settings" className="text-accent-600 hover:text-accent-700">
          Settings → Privacy
        </Link>
        :
      </p>
      <ul>
        <li><strong>Public</strong> — visible to anyone, including logged-out visitors.</li>
        <li><strong>University only</strong> — visible to signed-in members of the platform.</li>
        <li><strong>Connections only</strong> — visible only to accepted connections.</li>
        <li><strong>Private</strong> — visible only to you.</li>
      </ul>
      <p>
        The default settings are: profile public, email university-only, phone and contact
        connections-only, CGPA private, academic info university-only, social links
        university-only, projects and research public, activity and connections connections-only.
      </p>
      <p>
        <strong>How enforcement works</strong>: these settings are enforced on the server. When a
        field is hidden from a viewer, it is removed from the API response entirely — the data is
        never sent to the browser and merely hidden by the interface. This means hidden fields
        cannot be exposed through developer tools or API calls.
      </p>

      <h2>4. How your information is used</h2>
      <ul>
        <li>To operate your account and authenticate you (bcrypt-hashed passwords, short-lived
        access tokens, and refresh tokens stored in an HttpOnly cookie).</li>
        <li>To personalize discovery — recommending projects, people, and research based on your
        declared interests, skills, goals, and department.</li>
        <li>To deliver notifications for collaboration events you participate in (join requests,
        invitations, acceptances, messages).</li>
        <li>To enforce visibility and moderation — administrators can review reported content and
        verify role claims.</li>
        <li>To send transactional email (email verification, password reset) via an email
        provider.</li>
      </ul>

      <h2>5. Verification</h2>
      <p>
        Role verification (e.g. Verified Professor) is performed by platform administrators using
        the evidence you provide. Verification confirms institutional affiliation only. We do not
        claim that verification guarantees competence or outcomes.
      </p>

      <h2>6. What members (not UCN) can see</h2>
      <p>
        Other members can only see what your privacy settings allow. Project, research-team, and
        group membership is visible to other members of those same projects/teams/groups. Private
        projects and groups are not visible to non-members.
      </p>

      <h2>7. Cookies and local storage</h2>
      <ul>
        <li>
          <strong>One essential cookie</strong>: a single HttpOnly <code>refresh_token</code>{" "}
          cookie, used only for keeping you signed in (session restoration and token refresh). It
          is not used for tracking or advertising, and it expires after 7 days or on logout.
        </li>
        <li>
          <strong>Local storage</strong>: your short-lived access token and basic session state
          are kept in your browser's local storage to authenticate API requests. Clearing your
          browser storage signs you out.
        </li>
        <li>We do not use advertising, analytics, or third-party tracking cookies.</li>
      </ul>

      <h2>8. Data sharing</h2>
      <ul>
        <li>
          <strong>Email provider</strong>: your email address is shared with our transactional
          email provider solely to deliver verification and password-reset messages.
        </li>
        <li>We do not share your personal information with advertisers, data brokers, or any other third parties.</li>
      </ul>

      <h2>9. Security</h2>
      <p>
        We apply server-side security controls including password hashing (bcrypt), short-lived
        signed access tokens with refresh-token rotation and revocation, per-endpoint rate
        limiting, security headers (Content Security Policy, HSTS, frame protection), and
        server-side authorization on every protected resource. No system is perfectly secure —
        see the platform's security documentation for the full picture of what is and is not
        protected.
      </p>

      <h2>10. Data retention and deletion</h2>
      <ul>
        <li>
          Your profile and content are retained while your account is active. Account deletion
          requests can be directed to platform administrators.
        </li>
        <li>
          Upon account deletion, your profile and personal information are removed. Content that
          is part of a shared collaboration (e.g. project descriptions) may be retained in
          anonymized form where removal would break other members' records.
        </li>
        <li>Server logs are retained for a limited period for security and troubleshooting.</li>
      </ul>

      <h2>11. Your rights and choices</h2>
      <ul>
        <li>Control field-level visibility in Settings → Privacy at any time.</li>
        <li>Edit or remove profile information, skills, interests, and goals from your portfolio.</li>
        <li>Leave projects, teams, and groups at any time (revoking workspace access).</li>
        <li>Report members or content through the platform's reporting tools.</li>
        <li>Request account deletion through platform administrators.</li>
      </ul>

      <h2>12. Changes to this policy</h2>
      <p>
        Material changes will be posted on this page with an updated date. Continued use after
        changes are posted constitutes acceptance.
      </p>

      <h2>13. Contact</h2>
      <p>
        Privacy questions can be directed to platform administrators through the platform. See
        also our{" "}
        <Link to="/terms" className="text-accent-600 hover:text-accent-700">
          Terms of Service
        </Link>
        .
      </p>
    </LegalPageShell>
  );
}
