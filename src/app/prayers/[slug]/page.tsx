import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { PrayerChat } from "@/components/PrayerChat";
import { getPassage, getAllPassageSlugs } from "@/lib/content";
import { ROSARY_BEADS } from "@/lib/rosary";

export async function generateStaticParams() {
  const slugs = await getAllPassageSlugs();
  return slugs.map((slug) => ({ slug }));
}

export default async function PrayerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const passage = await getPassage(slug);
  if (!passage) notFound();

  const beads = ROSARY_BEADS[slug];

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 pb-24">
        <div className="py-6">
          <Link
            href="/"
            className="font-sans text-sm text-ink-faint transition-colors hover:text-gold"
          >
            ← All prayers
          </Link>
        </div>

        {beads && (
          <details className="group mb-6 rounded-xl border border-hairline bg-parchment-raised">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-sans text-sm font-medium text-ink-soft [&::-webkit-details-marker]:hidden">
              <span className="inline-flex items-center gap-2">
                <span aria-hidden>📿</span> Where in the Rosary
              </span>
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="text-ink-faint transition-transform group-open:rotate-180"
                aria-hidden
              >
                <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </summary>
            <p className="px-4 pb-4 font-sans text-sm leading-relaxed text-ink-soft">
              {beads}
            </p>
          </details>
        )}

        <header className="mb-8 text-center">
          <h1 className="font-serif text-4xl text-ink sm:text-5xl">
            {passage.title}
          </h1>
          {passage.source && (
            <p className="mt-2 font-sans text-sm text-ink-soft">
              {passage.source}
            </p>
          )}
          <p className="mt-4 font-sans text-sm text-ink-faint">
            {passage.segments.length} lines · gold words are the connective
            anchors that hold it together
          </p>
        </header>

        <PrayerChat passage={passage} />
      </main>
    </>
  );
}
