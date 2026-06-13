import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { getContentSets } from "@/lib/content";

const TIER_LABELS: Record<number, string> = {
  1: "Foundational",
  2: "Common but harder",
  3: "Latin",
};

export default async function Home() {
  const sets = await getContentSets();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-24">
        {/* Hero */}
        <section className="py-14 text-center sm:py-20">
          <p className="mb-4 font-sans text-xs uppercase tracking-[0.25em] text-gold">
            Learn them by heart
          </p>
          <h1 className="font-serif text-5xl leading-tight text-ink sm:text-6xl">
            Commit the prayers
            <br />
            to memory
          </h1>
          <p className="mx-auto mt-6 max-w-xl font-sans text-base leading-relaxed text-ink-soft">
            Memoria turns recitation into a conversation — practiced line by
            line, the old way: chunking, call-and-response, and the connective
            words that hold a prayer together.
          </p>
        </section>

        {/* Catalog */}
        {sets.map((set) => {
          const byTier = groupByTier(set.passages);
          return (
            <section key={set.id} className="mb-12">
              <div className="mb-6 flex items-baseline justify-between border-b border-hairline pb-2">
                <h2 className="font-serif text-2xl text-ink">{set.title}</h2>
                <span className="font-sans text-sm text-ink-faint">
                  {set.passages.length} prayers
                </span>
              </div>

              {[...byTier.keys()].sort().map((tier) => (
                <div key={tier} className="mb-8">
                  <h3 className="mb-3 font-sans text-xs uppercase tracking-[0.2em] text-ink-faint">
                    {TIER_LABELS[tier] ?? `Tier ${tier}`}
                  </h3>
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {byTier.get(tier)!.map((p) => (
                      <li key={p.id}>
                        <Link
                          href={`/prayers/${p.slug}`}
                          className="group block rounded-2xl border border-hairline bg-parchment-raised p-5 shadow-[var(--bubble-shadow)] transition-all hover:-translate-y-0.5 hover:border-gold/40"
                        >
                          <div className="flex items-center justify-between">
                            <h4 className="font-serif text-xl text-ink">
                              {p.title}
                            </h4>
                            <span className="font-sans text-sm text-ink-faint transition-colors group-hover:text-gold">
                              {p.segments.length} lines →
                            </span>
                          </div>
                          {p.source && (
                            <p className="mt-1 font-sans text-sm text-ink-soft">
                              {p.source}
                            </p>
                          )}
                          {p.dialogic && (
                            <span className="mt-3 inline-block rounded-full bg-caller/10 px-2.5 py-0.5 font-sans text-xs text-caller">
                              Call &amp; response
                            </span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          );
        })}

        {sets.length === 0 && (
          <p className="py-20 text-center font-sans text-ink-faint">
            No content yet. Run <code>npm run db:seed</code>.
          </p>
        )}
      </main>
    </>
  );
}

function groupByTier<T extends { tier: number }>(items: T[]): Map<number, T[]> {
  const map = new Map<number, T[]>();
  for (const item of items) {
    const arr = map.get(item.tier) ?? [];
    arr.push(item);
    map.set(item.tier, arr);
  }
  return map;
}
