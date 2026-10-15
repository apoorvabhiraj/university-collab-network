import { Link } from "react-router-dom";
import { LegalPageShell } from "./LegalPageShell";

export default function TermsPage(): JSX.Element {
  return (
    <LegalPageShell title="Terms of Service" lastUpdated="October 16, 2026">
      <p>
        These Terms of Service ("Terms") govern your use of the University Collaboration Network
        ("UCN", "the platform"), a university-scoped collaboration platform connecting students,
        professors, researchers, and campus organizations for projects, research, and
        opportunities. By creating an account or using the platform, you agree to these Terms.
      </p>

      <h2>1. Eligibility and accounts</h2>
      <ul>
        <li>
          UCN is intended for members of university communities — students, faculty, researchers,
          alumni, professionals, and campus organizations.
        </li>
        <li>
          You must provide a valid email address. University email domains may be used for
          institutional verification; misrepresenting your affiliation is a violation of these
          Terms.
        </li>
        <li>
          You are responsible for maintaining the confidentiality of your password and for all
          activity under your account.
        </li>
        <li>One person may hold one account. Duplicate accounts may be removed.</li>
      </ul>

      <h2>2. Your status and activities</h2>
      <p>
        During onboarding you declare an academic or professional status (Student, Faculty,
        Researcher, Professional, or Alumni). This status is a <strong>self-declared
        context</strong> used to personalize your experience. It does not, by itself, grant any
        privileged capability.
      </p>
      <ul>
        <li>
          <strong>Verification</strong>: Administrative verification of a role (e.g. Verified
          Professor) is performed by platform administrators and is separate from email
          verification. Verified status confirms institutional affiliation only — it does not
          guarantee competence, quality, or outcomes.
        </li>
        <li>
          <strong>Multiple activities</strong>: You may simultaneously lead projects, contribute
          to research, belong to organizations, and participate in startups. Each such
          relationship is created and managed separately through the platform.
        </li>
      </ul>

      <h2>3. Acceptable use</h2>
      <p>You agree NOT to:</p>
      <ul>
        <li>Harass, threaten, discriminate against, or intimidate other members.</li>
        <li>Post content that is unlawful, defamatory, fraudulent, or infringes others' rights.</li>
        <li>
          Impersonate another person or misrepresent your university affiliation, credentials, or
          verification status.
        </li>
        <li>
          Use the platform for spam, unsolicited recruiting, or commercial solicitation outside
          its collaboration purpose.
        </li>
        <li>
          Attempt to access other users' private data, accounts, projects, groups, or
          conversations without authorization.
        </li>
        <li>Scrape, harvest, or bulk-export member data or private content.</li>
        <li>Interfere with the platform's operation, including automated abuse of its APIs.</li>
      </ul>

      <h2>4. Content and ownership</h2>
      <ul>
        <li>
          You retain ownership of content you create (projects, publications, profile
          information, messages). By posting it, you grant UCN a limited license to display it
          within the platform according to your privacy settings.
        </li>
        <li>
          You are responsible for the accuracy of what you post. Portfolio and project content
          should reflect real work — do not fabricate accomplishments or claim others' work.
        </li>
        <li>
          UCN may remove content that violates these Terms and may suspend or ban accounts for
          serious or repeated violations, with moderation actions recorded by administrators.
        </li>
      </ul>

      <h2>5. Privacy and visibility</h2>
      <p>
        Your use of UCN is also governed by our{" "}
        <Link to="/privacy" className="text-accent-600 hover:text-accent-700">
          Privacy Policy
        </Link>
        . The platform provides field-level privacy controls (public, university-only,
        connections-only, private) that are enforced server-side. You are responsible for
        choosing visibility settings appropriate for the information you share.
      </p>

      <h2>6. Collaboration, projects, and groups</h2>
      <ul>
        <li>
          Projects, research teams, groups, and events on UCN are created and managed by members,
          not by UCN. UCN provides the tools but is not a party to any collaboration agreement
          between members.
        </li>
        <li>
          Join requests and invitations are consent-based: an invitation does not make you a
          member until you accept; a join request does not make someone a member until the
          project/team owner accepts.
        </li>
        <li>
          Group invite links are time-limited and controlled by the group owner. Joining through
          a link is a deliberate action you take on an invitation page — links never add you to a
          group automatically.
        </li>
        <li>
          Project owners may review, accept, or decline join requests and may remove members from
          their own projects. Removal revokes access to that project's workspace and chat.
        </li>
      </ul>

      <h2>7. Messaging and communication</h2>
      <ul>
        <li>
          Messages you send are visible to the conversation's members. You can report abusive
          messages or members through the platform's reporting tools.
        </li>
        <li>
          Do not use messaging to send unsolicited commercial offers, spam, or content that
          violates Section 3.
        </li>
      </ul>

      <h2>8. Disclaimers</h2>
      <ul>
        <li>
          UCN is provided "as is" without warranties of any kind. We do not warrant that the
          platform will be uninterrupted or error-free.
        </li>
        <li>
          UCN does not endorse, verify the qualifications of, or guarantee the outcomes of any
          collaboration, project, publication, or opportunity arranged through the platform.
          Exercise your own judgment before sharing personal information or entering
          collaborations.
        </li>
        <li>
          To the maximum extent permitted by law, UCN and its operators are not liable for
          indirect, incidental, or consequential damages arising from your use of the platform or
          interactions with other members.
        </li>
      </ul>

      <h2>9. Moderation and enforcement</h2>
      <p>
        Platform administrators may review reported content, verify or reject role claims,
        suspend or ban accounts, and remove content that violates these Terms. Moderation
        decisions are recorded. If your account is suspended or banned, you may not create a new
        account without our permission.
      </p>

      <h2>10. Termination</h2>
      <p>
        You may stop using the platform at any time. Account deletion requests can be directed to
        platform administrators; upon deletion, your profile and personal information are removed
        in accordance with our Privacy Policy. We may suspend or terminate accounts that violate
        these Terms.
      </p>

      <h2>11. Changes to these Terms</h2>
      <p>
        We may update these Terms as the platform evolves. Material changes will be posted on
        this page with an updated date. Continued use of the platform after changes are posted
        constitutes acceptance of the updated Terms.
      </p>

      <h2>12. Contact</h2>
      <p>
        Questions about these Terms can be directed to platform administrators through the
        platform or to the email address displayed on the platform's landing page.
      </p>
    </LegalPageShell>
  );
}
