import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteNav } from "@/components/site/site";
import { getMessages } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "How it's designed",
  description: "Who Haat Studio is for, the journey it supports, the principles behind every screen, and how we tested it.",
};

const DOCS = "https://github.com/AmrendraTheCoder/haat-studio/blob/main/docs/ux";

const PEOPLE = [
  { name: "Priya", role: "Home boutique · Jaipur", need: "Her kurtis to look as good online as in hand — before Diwali.", design: "Works from a phone photo on a bed, in under a minute, nothing to learn." },
  { name: "Imran", role: "Reseller · Surat", need: "Thirty posts a week, with prices and discounts clear.", design: "MRP becomes “% off” automatically; shop details are remembered; exact profit per piece." },
  { name: "Meena", role: "Maker · Lucknow", need: "To be told what to post, without breaking anything.", design: "Plain words, big targets, every error explains itself, Hinglish captions, a printable plan." },
];

const PRINCIPLES = [
  ["One decision per screen", "Three short steps instead of one long form."],
  ["Never a dead button", "A disabled button always says why, right under it."],
  ["Say the cost before the click", "“Takes about 15–30 seconds and uses a little of today’s free GPU time.”"],
  ["Show the real work", "The progress panel shows only stages the server actually reported."],
  ["Never invent a result", "Empty slots say they’re empty; AI and template text are labelled."],
  ["The seller’s words are exact", "Prices and names are drawn by code — an AI never retypes them."],
  ["Phone first, one hand", "Every control 44 px or larger; the main action sticks to the bottom."],
  ["Recover, don’t scold", "Every error names the cause and offers the next step."],
];

const JOURNEY = [
  ["Find", "Drags a real before/after", "Curious"],
  ["Photo", "Uploads a kurti shot on her bed", "Hopeful"],
  ["Wait", "Watches each real stage", "Impatient → reassured"],
  ["Check", "Slider + full screen", "Does it still look like mine?"],
  ["Post", "Name, ₹799, MRP ₹999", "Wants it to look pro"],
  ["Caption", "Hinglish, exact price", "Relief"],
  ["Share", "One tap to Instagram", "Done"],
  ["Plan", "Ten answers → a week", "Has direction"],
];

const CHANGES = [
  ["Posting was buried below four download tiles on the result", "“Make it a post →” is now the first action"],
  ["Phones had to download, find the file, then open Instagram", "Share to Instagram / WhatsApp in one tap, caption on the clipboard"],
  ["No hint of time or cost before Create", "The cost is stated before the click"],
  ["A skirt on a model in a dress blended into the dress (11/30)", "Every model shows ✓/✗ for the garment type, with a one-tap fix (29/30)"],
  ["iPhones zoomed the page when a field was tapped", "16 px inputs on phones"],
  ["Saved shop details were wiped when the post maker opened", "Saved only after reading what’s stored"],
];

const NUMBERS = [
  ["10 → 0", "text styles below the contrast minimum"],
  ["36+ → 0", "controls smaller than 44 × 44 px"],
  ["6 → 0", "option groups without arrow-key support"],
  ["5", "progress announcements a screen reader hears while a photo is made"],
];

const SWATCHES = [
  ["paper", "bg-paper", "Page"],
  ["ink", "bg-ink", "Text · primary"],
  ["ink-3", "bg-ink-3", "Hints · 5.6:1"],
  ["accent-strong", "bg-accent-strong", "Payoff moments"],
  ["marigold", "bg-marigold", "Heads up"],
  ["good", "bg-good", "Ready · 5.5:1"],
  ["danger", "bg-danger", "Errors · 5.2:1"],
];

export default async function DesignPage() {
  const { locale, t } = await getMessages();
  return (
    <main className="overflow-x-clip">
      <SiteNav />

      <section lang="en" className="mx-auto max-w-6xl px-4 pt-14 pb-10 sm:px-6">
        {locale === "hi" && (
          <p lang="hi" className="mb-6 rounded-xl border border-line bg-paper-glow px-4 py-3 text-sm">
            {t.design.englishOnly}
          </p>
        )}
        <p className="kicker">How it&rsquo;s designed</p>
        <h1 className="mt-4 font-extrabold leading-[0.9] tracking-[-0.06em]" style={{ fontSize: "var(--text-giant)" }}>
          designed for a seller
          <br />
          <span className="text-ink-2">with a phone and an hour.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-ink-2">
          Who Haat Studio is for, the journey it supports, the rules every screen follows, and what testing changed. The full
          write-up is in the{" "}
          <a className="underline" href={DOCS} target="_blank" rel="noreferrer">
            UX documents
          </a>
          .
        </p>
      </section>

      <section lang="en" className="mx-auto max-w-6xl px-4 py-10 sm:px-6" aria-labelledby="who">
        <h2 id="who" className="text-3xl font-extrabold tracking-tight">
          Who it&rsquo;s for
        </h2>
        <p className="mt-2 max-w-2xl text-ink-2">
          Small clothing sellers who sell on Instagram and WhatsApp. These three are <strong>proto-personas</strong> — assumptions
          we design for and will test with real sellers.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {PEOPLE.map((p) => (
            <article key={p.name} className="card p-5">
              <p className="text-2xl font-bold">{p.name}</p>
              <p className="font-mono text-xs text-ink-3">{p.role}</p>
              <p className="mt-3 text-sm">
                <strong>Needs:</strong> {p.need}
              </p>
              <p className="mt-2 text-sm text-ink-2">
                <strong className="text-ink">So we:</strong> {p.design}
              </p>
            </article>
          ))}
        </div>
        <p className="mt-6 rounded-2xl bg-ink px-5 py-4 text-lg text-paper">
          The job they hire it for: <strong>&ldquo;Help me post this product so it sells — today, without a shoot.&rdquo;</strong>
        </p>
      </section>

      <section lang="en" className="mx-auto max-w-6xl px-4 py-10 sm:px-6" aria-labelledby="journey">
        <h2 id="journey" className="text-3xl font-extrabold tracking-tight">
          Priya&rsquo;s Monday, start to posted
        </h2>
        <ol className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {JOURNEY.map(([stage, does, feels], i) => (
            <li key={stage} className={`rounded-2xl border p-3 ${stage === "Check" || stage === "Share" ? "border-accent-strong bg-accent-wash" : "border-line bg-paper-glow"}`}>
              <span className="font-mono text-2xs text-ink-3">{String(i + 1).padStart(2, "0")}</span>
              <p className="font-bold">{stage}</p>
              <p className="mt-1 text-xs">{does}</p>
              <p className="mt-2 text-2xs text-ink-2 italic">{feels}</p>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-sm text-ink-2">
          Highlighted: the two moments that decide everything — <strong>Check</strong> (if the garment changed, she won&rsquo;t post
          it) and <strong>Share</strong> (if posting takes more than a tap or two, she goes back to her old way).
        </p>
      </section>

      <section lang="en" className="mx-auto max-w-6xl px-4 py-10 sm:px-6" aria-labelledby="principles">
        <h2 id="principles" className="text-3xl font-extrabold tracking-tight">
          Eight rules every screen follows
        </h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PRINCIPLES.map(([title, body], i) => (
            <div key={title} className="card p-4">
              <span className="font-mono text-2xs text-ink-3">{String(i + 1).padStart(2, "0")}</span>
              <p className="mt-1 font-bold">{title}</p>
              <p className="mt-1 text-sm text-ink-2">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section lang="en" className="mx-auto max-w-6xl px-4 py-10 sm:px-6" aria-labelledby="changes">
        <h2 id="changes" className="text-3xl font-extrabold tracking-tight">
          What testing changed
        </h2>
        <p className="mt-2 max-w-2xl text-ink-2">
          Every flow was walked as a seller would — on a phone-sized screen, with real try-ons and real key presses. Some of what
          broke, and what we did:
        </p>
        <div className="mt-6 overflow-hidden rounded-2xl border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-paper-3">
              <tr>
                <th scope="col" className="p-3 font-semibold">
                  Found
                </th>
                <th scope="col" className="p-3 font-semibold">
                  Changed
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line bg-paper-glow">
              {CHANGES.map(([found, fix]) => (
                <tr key={found}>
                  <td className="p-3 align-top text-ink-2">{found}</td>
                  <td className="p-3 align-top">{fix}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section lang="en" className="mx-auto max-w-6xl px-4 py-10 sm:px-6" aria-labelledby="access">
        <h2 id="access" className="text-3xl font-extrabold tracking-tight">
          Accessible by default
        </h2>
        <p className="mt-2 max-w-2xl text-ink-2">Audited against WCAG 2.1 AA, with 44 px touch targets because sellers are on phones.</p>
        <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {NUMBERS.map(([n, label]) => (
            <div key={label} className="card p-5">
              <dt className="sr-only">{label}</dt>
              <dd className="text-4xl font-extrabold tracking-tight">{n}</dd>
              <dd className="mt-1 text-sm text-ink-2">{label}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section lang="en" className="mx-auto max-w-6xl px-4 py-10 sm:px-6" aria-labelledby="system">
        <h2 id="system" className="text-3xl font-extrabold tracking-tight">
          The look
        </h2>
        <p className="mt-2 max-w-2xl text-ink-2">
          Cream paper, warm ink, one magenta splash — a craft-market stall, not a tech dashboard. Inter and Geist Mono, bundled so it
          renders the same offline.
        </p>
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {SWATCHES.map(([name, cls, use]) => (
            <li key={name} className="overflow-hidden rounded-2xl border border-line">
              <div className={`h-16 ${cls}`} aria-hidden />
              <div className="bg-paper-glow p-2.5">
                <p className="font-mono text-xs font-medium">{name}</p>
                <p className="text-2xs text-ink-3">{use}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="card p-5">
            <p className="font-extrabold tracking-[-0.05em]" style={{ fontSize: "3rem", lineHeight: 1 }}>
              your product.
            </p>
            <p className="mt-2 font-mono text-xs text-ink-3">Display · Inter 800 · lowercase · tight</p>
            <p className="mt-4">Body · Inter 400 · 16 px on phones so text is readable without zooming.</p>
            <p className="mt-2 font-mono text-xs tracking-wider text-ink-3 uppercase">Labels · Geist Mono · 11 px floor</p>
          </div>
          <div className="card space-y-3 p-5">
            <div className="flex flex-wrap gap-2">
              <span className="btn-primary pointer-events-none">Continue →</span>
              <span className="btn-ghost pointer-events-none">← Back</span>
            </div>
            <p className="text-xs text-ink-3">One primary action per area. A disabled button always has its reason underneath.</p>
            <p className="rounded-xl border border-danger/40 bg-danger-wash px-4 py-3 text-sm">
              This product photo is HEIC. Export it as JPEG first (on iPhone: Settings → Camera → Formats → Most Compatible).
            </p>
            <p className="text-xs text-ink-3">Errors say what happened and what to do next.</p>
          </div>
        </div>
      </section>

      <section lang="en" className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="rounded-3xl border border-line bg-paper-3 px-6 py-10">
          <h2 className="text-2xl font-extrabold tracking-tight">What we still don&rsquo;t know</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-ink-2">
            <li>No real seller has used it yet — the next step is testing with five sellers on their own phones.</li>
            <li>The interface is English only; a Hindi version is the biggest open improvement.</li>
            <li>Screen readers were checked through the code&rsquo;s structure, not yet on a real phone with VoiceOver or TalkBack.</li>
          </ul>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/studio" className="btn-primary">
              Try the studio →
            </Link>
            <a href={DOCS} target="_blank" rel="noreferrer" className="btn-ghost">
              Read the UX documents
            </a>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
