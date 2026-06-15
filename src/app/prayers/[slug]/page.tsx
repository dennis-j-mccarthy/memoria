import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { PrayerChat } from "@/components/PrayerChat";
import { getPassage, getAllPassageSlugs } from "@/lib/content";
import { ROSARY_BEADS } from "@/lib/rosary";
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
          <Suspense fallback={null}>
            <RosaryPosition slug={slug} note={beads} />
          </Suspense>
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

        {/* key on slug forces a fresh mount when navigating prayer→prayer
            (e.g. via the rosary bead pills), so per-passage state resets. */}
        <PrayerChat key={passage.slug} passage={passage} />
      </main>
    </>
  );
}
