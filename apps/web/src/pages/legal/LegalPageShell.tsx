import { Link } from "react-router-dom";

/**
 * LegalPageShell — shared layout for public legal pages (Terms, Privacy).
 * Public routes: no auth required. Consistent typography per the design
 * system; content matches UCN's ACTUAL enforcement model — no invented
 * promises (verification does not imply competence; security is
 * best-effort with documented controls, per docs/security-audit.md).
 */
export function LegalPageShell({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight text-text-primary">{title}</h1>
      <p className="mt-2 text-sm text-text-muted">Last updated: {lastUpdated}</p>
      <div className="mt-8 space-y-6 text-sm leading-relaxed text-text-secondary [&_h2]:mt-10 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-text-primary [&_li]:mt-1 [&_li]:ml-5 [&_ul]:list-disc [&_ul]:space-y-1">
        {children}
      </div>
      <div className="mt-12 border-t border-border pt-6 text-sm">
        <Link to="/" className="text-accent-600 hover:text-accent-700">
          ← Back to home
        </Link>
      </div>
    </div>
  );
}
