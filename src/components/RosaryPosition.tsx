"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { RosaryDiagram } from "@/components/RosaryDiagram";
import {
  beadPrayers,
  BEAD_PRAYERS_BY_DEVOTION,
  type BeadType,
  type Devotion,
} from "@/lib/rosary";

function asBeadType(v: string | null): BeadType | null {
  return v && v in BEAD_PRAYERS_BY_DEVOTION.rosary ? (v as BeadType) : null;
}

/**
 * The "Where in the Rosary" map with the interactive bead diagram. Tapping a
 * bead opens its prayer; beads that carry more than one prayer (crucifix,
 * centerpiece, …) show a chooser of navigation pills. The chosen bead lives in
 * the URL (?bead=…) so the chooser stays open — with the current prayer
 * highlighted — as you hop between the prayers on that bead.
 */
export function RosaryPosition({
  slug,
  note,
  devotion,
}: {
  slug: string;
  note: string;
  devotion: Devotion;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const picked = asBeadType(params.get("bead"));

  function handlePick(type: BeadType) {
    const prayers = beadPrayers(devotion, type);
    if (prayers.length === 1) {
      router.push(`/prayers/${prayers[0].slug}`);
    } else {
      // Open the chooser on this page by recording the bead in the URL.
      router.push(`/prayers/${slug}?bead=${type}`, { scroll: false });
    }
  }

  const title = devotion === "chaplet" ? "On the chaplet beads" : "Where in the Rosary";

  return (
    <div className="mb-6">
      <div className="rounded-xl border border-hairline bg-parchment-raised">
        <p className="flex items-center gap-2 px-4 pt-3 font-sans text-sm font-medium text-ink-soft">
          <span aria-hidden>📿</span> {title}
        </p>
        <div className="px-4 pb-4">
          <RosaryDiagram
            slug={slug}
            devotion={devotion}
            picked={picked}
            onPick={handlePick}
          />
          <p className="mt-2 font-sans text-sm leading-relaxed text-ink-soft">
            {note}
          </p>
        </div>
      </div>

      {picked && (
        <div className="mt-3 rounded-xl border border-gold/40 bg-gold/5 px-4 py-3">
          <p className="font-sans text-xs uppercase tracking-[0.15em] text-ink-faint">
            On this bead — open a prayer
          </p>
          <ul className="mt-2 flex flex-wrap items-center gap-2">
            {beadPrayers(devotion, picked).map((p) => {
              const current = p.slug === slug;
              return (
                <li key={p.slug}>
                  <Link
                    href={`/prayers/${p.slug}?bead=${picked}`}
                    aria-current={current ? "page" : undefined}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 font-sans text-sm transition-colors ${
                      current
                        ? "border-gold bg-gold text-parchment-raised"
                        : "border-hairline bg-parchment-raised text-ink hover:border-gold/50 hover:text-gold"
                    }`}
                  >
                    {p.title}
                    {current ? (
                      <span className="text-xs opacity-80">· here</span>
                    ) : (
                      <span aria-hidden>→</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
