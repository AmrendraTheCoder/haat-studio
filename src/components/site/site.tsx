import Link from "next/link";

/** Lowercase display wordmark with the magenta full stop, as in stiche-v2. */
export function HaatWord({ className = "", suffix }: { className?: string; suffix?: string }) {
  return (
    <span className={`inline-flex items-baseline font-display font-extrabold tracking-[-0.06em] ${className}`}>
      haat<span className="text-accent-strong">.</span>
      {suffix && <span className="ml-1.5 font-mono text-[0.42em] font-medium tracking-normal text-ink-3">{suffix}</span>}
    </span>
  );
}

/** Renders the items twice so the -50% keyframe loops without a gap. Hover pauses. */
export function ScrollingStrip({ items, className = "" }: { items: readonly string[]; className?: string }) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <ul className="strip flex w-max items-center gap-10 pr-10">
        {items.concat(items).map((item, i) => (
          <li key={i} className="flex items-center gap-10 whitespace-nowrap" aria-hidden={i >= items.length}>
            <span>{item}</span>
            <span aria-hidden className="inline-block size-2 rounded-full bg-current opacity-40" />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Marquee's scallop border: one 80px tile repeated, drifting one tile per loop. CSS only. */
export function WaveBorder({ flip = false, className = "" }: { flip?: boolean; className?: string }) {
  const id = flip ? "scallop-flip" : "scallop";
  return (
    <div aria-hidden className={`relative h-12 overflow-hidden ${className}`} style={flip ? { transform: "scaleY(-1)" } : undefined}>
      <svg className="scallop absolute inset-y-0 left-0 h-12" style={{ width: "calc(100% + 80px)" }}>
        <defs>
          <pattern id={id} width="80" height="48" patternUnits="userSpaceOnUse">
            <path d="M 0 48 L 0 28 A 40 22 0 0 1 80 28 L 80 48 Z" fill="var(--color-ink)" />
            <path d="M 6 30 A 34 17 0 0 1 74 30" stroke="var(--color-paper)" strokeWidth="0.6" fill="none" opacity="0.5" />
            <circle cx="40" cy="14" r="1" fill="var(--color-ink)" opacity="0.7" />
          </pattern>
        </defs>
        <rect width="100%" height="48" fill={`url(#${id})`} />
      </svg>
    </div>
  );
}

const NAV = [
  { href: "/#how", label: "How it works" },
  { href: "/#examples", label: "Examples" },
  { href: "/#under-the-hood", label: "Under the hood" },
  { href: "/#next", label: "What's next" },
] as const;

export function SiteNav({ cta = true }: { cta?: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-paper/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" aria-label="Haat Studio — home">
          <HaatWord className="text-2xl" suffix="studio" />
        </Link>
        <nav className="hidden items-center gap-7 text-sm md:flex">
          {NAV.map((i) => (
            <Link key={i.href} href={i.href} className="text-ink-2 transition-colors hover:text-ink">
              {i.label}
            </Link>
          ))}
        </nav>
        {cta && (
          <Link href="/studio" className="btn-primary !px-4 !py-2">
            Open studio <span aria-hidden>→</span>
          </Link>
        )}
      </div>
    </header>
  );
}

const TICKER = ["Flat-lay to on-model", "No photoshoot", "No model fees", "Sized for Instagram", "Free GPU", "Made for Indian sellers"];

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line bg-paper-2">
      <div className="border-b border-line py-5 text-ink-2">
        <ScrollingStrip items={TICKER} className="font-display text-xl font-bold tracking-tight sm:text-2xl" />
      </div>
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 md:flex-row md:items-end md:justify-between">
        <div>
          <HaatWord className="text-5xl" />
          <p className="mt-3 max-w-md text-sm text-ink-3">
            Haat Studio is part 1 of Haat, an assistant for India&rsquo;s Instagram sellers. Try-on by FASHN VTON 1.5
            (Apache-2.0) on Hugging Face&rsquo;s free GPUs.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-ink-2">
          <Link href="/studio">Studio</Link>
          <Link href="/#under-the-hood">Under the hood</Link>
          <a href="https://github.com/AmrendraTheCoder/haat-studio" target="_blank" rel="noreferrer">
            Source on GitHub
          </a>
        </nav>
      </div>
    </footer>
  );
}
