"use client";

import { useState } from "react";
import { RosaryDiagram } from "@/components/RosaryDiagram";
import {
  adjacentPrayers,
  beadPrayers,
  devotionForSlug,
  DEVOTIONS,
  DEVOTION_LABEL,
  type BeadType,
  type Devotion,
} from "@/lib/rosary";

/**
 * The "Where in the Rosary" / "On the chaplet beads" map, inside the immersive
 * Player. Reuses the shared diagram + bead data, but taps navigate within the
 * immersive app (onPrayer) and multi-prayer beads show a glass pill chooser.
 */
export function ImmersiveRosaryMap({
  slug,
  onPrayer,
  onPractice,
  textFor,
}: {
  slug: string;
  onPrayer: (slug: string) => void;
  onPractice?: (slug: string) => void;
  textFor?: (slug: string) => string[] | null;
}) {
  const devotion = devotionForSlug(slug);
  const [picked, setPicked] = useState<BeadType | null>(null);
  // Which devotion's beads are showing; the tabs flip between the two diagrams.
  const [active, setActive] = useState<Devotion>(devotion ?? "rosary");
  if (!devotion) return null;

  const { prev, next } = adjacentPrayers(active, slug);

  function handlePick(type: BeadType) {
    const prayers = beadPrayers(active, type);
    if (prayers.length === 1) onPrayer(prayers[0].slug);
    else setPicked(type);
  }

  return (
    <div
      style={{
        marginTop: 24,
        borderRadius: 22,
        padding: "14px 16px 16px",
        background: "var(--glass)",
        border: "1px solid var(--glass-border)",
      }}
    >
      <div
        role="tablist"
        aria-label="Devotion"
        style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 4 }}
      >
        {DEVOTIONS.map((d) => {
          const on = d === active;
          return (
            <button
              key={d}
              role="tab"
              aria-selected={on}
              onClick={() => setActive(d)}
              style={{
                borderRadius: 999,
                padding: "5px 14px",
                fontSize: 12.5,
                fontWeight: 700,
                fontFamily: "var(--font-serif), Georgia, serif",
                cursor: "pointer",
                background: on ? "var(--gold)" : "var(--chip-bg)",
                color: on ? "var(--gold-text)" : "var(--ink-soft)",
                border: "1px solid " + (on ? "var(--gold)" : "var(--chip-bd)"),
              }}
            >
              {DEVOTION_LABEL[d]}
            </button>
          );
        })}
      </div>
      <RosaryDiagram
        slug={slug}
        devotion={active}
        picked={picked}
        onPick={handlePick}
        onPractice={onPractice}
        textFor={textFor}
        onPrev={prev ? () => onPrayer(prev.slug) : undefined}
        onNext={next ? () => onPrayer(next.slug) : undefined}
      />
      {picked && (
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 12 }}>
          {beadPrayers(active, picked).map((pr) => {
            const current = pr.slug === slug;
            return (
              <button
                key={pr.slug}
                onClick={() => onPrayer(pr.slug)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  borderRadius: 999,
                  padding: "7px 14px",
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "var(--font-serif), Georgia, serif",
                  background: current ? "var(--gold)" : "var(--chip-bg)",
                  color: current ? "var(--gold-text)" : "var(--ink)",
                  border: "1px solid " + (current ? "var(--gold)" : "var(--chip-bd)"),
                }}
              >
                {pr.title}
                {!current && <span aria-hidden>→</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
