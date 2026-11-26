import type { ReactNode, Ref } from "react";

/**
 * Every working page opens the same way, as in Polaris and Ads Manager: an
 * optional back link or kicker, the title (with its help "?"), one line of
 * description, and the page's main action on the right. A rule below separates
 * the header from the work. No hooks, so server and client pages both use it.
 */
export function PageHeader({
  title,
  lead,
  kicker,
  back,
  help,
  actions,
  headingRef,
  className = "",
}: {
  title: ReactNode;
  lead?: ReactNode;
  kicker?: ReactNode;
  /** A link back to where the seller came from, shown above the title. */
  back?: ReactNode;
  /** Usually a <HelpTip>, placed right after the title. */
  help?: ReactNode;
  /** The page's primary (and at most one secondary) action. */
  actions?: ReactNode;
  /** For pages that move focus to the heading when they change. */
  headingRef?: Ref<HTMLHeadingElement>;
  className?: string;
}) {
  return (
    <header className={`page-header ${className}`}>
      <div className="min-w-0 flex-1">
        {back && <div className="-mt-2 mb-1 print:hidden">{back}</div>}
        {kicker && <p className="kicker mb-1.5">{kicker}</p>}
        <div className="flex items-center gap-2">
          <h1 ref={headingRef} tabIndex={headingRef ? -1 : undefined} className="h-page outline-none">
            {title}
          </h1>
          {help}
        </div>
        {lead && <p className="mt-1.5 max-w-3xl text-base leading-relaxed text-ink-2">{lead}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2 print:hidden">{actions}</div>}
    </header>
  );
}
