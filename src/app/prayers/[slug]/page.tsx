import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { PrayerChat } from "@/components/PrayerChat";
import { getPassage, getAllPassageSlugs } from "@/lib/content";
import { ROSARY_BEADS, devotionForSlug } from "@/lib/rosary";
import { RosaryPosition } from "@/components/RosaryPosition";

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
  const devotion = devotionForSlug(slug);
  const hasDiagram = !!(beads && devotion);

  return (
    <>
      <SiteHeader />
      {/* With a diagram, widen on desktop so the prayer and diagram sit side by
          side; without one, the prayer keeps its comfortable reading column. */}
      <main
        className={`mx-auto w-full flex-1 px-5 pb-24 ${
          hasDiagram ? "max-w-2xl lg:max-w-6xl" : "max-w-2xl"
        }`}
      >
        <div className="py-6">
          <Link
            href="/"
            className="font-sans text-sm text-ink-faint transition-colors hover:text-gold"
          >
            ← All prayers
          </Link>
        </div>

        {/* Mobile: flex column (diagram on top via order). Desktop: two columns
            with the prayer as the main reading area and the diagram as a sticky
            sidebar beside it. */}
        <div
          className={
            hasDiagram
              ? "flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-12"
              : ""
          }
        >
          <div className={hasDiagram ? "order-2 min-w-0 lg:order-1" : ""}>
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
                {passage.segments.length} lines · highlighted words are the
                connective anchors that hold it together
              </p>
            </header>

            {/* key on slug forces a fresh mount when navigating prayer→prayer
                (e.g. via the rosary bead pills), so per-passage state resets. */}
            <PrayerChat key={passage.slug} passage={passage} />
          </div>

          {beads && devotion && (
            <div className="order-1 lg:order-2 lg:sticky lg:top-6">
              <Suspense fallback={null}>
                <RosaryPosition slug={slug} note={beads} devotion={devotion} />
              </Suspense>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
