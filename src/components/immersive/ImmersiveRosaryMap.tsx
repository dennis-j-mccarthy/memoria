"use client";

import { useState } from "react";
import { RosaryDiagram } from "@/components/RosaryDiagram";
import {
  beadPrayers,
  devotionForSlug,
  devotionPrayers,
  ROSARY_BEADS,
  type BeadType,
} from "@/lib/rosary";

/**
 * The "Where in the Rosary" / "On the chaplet beads" map, inside the immersive
 * Player. Reuses the shared diagram + bead data, but taps navigate within the
 * immersive app (onPrayer) and multi-prayer beads show a glass pill chooser.
 */
export function ImmersiveRosaryMap({
  slug,
  onPrayer,
}: {
  slug: string;
  onPrayer: (slug: string) => void;
}) {
  const devotion = devotionForSlug(slug);
  const [picked, setPicked] = useState<BeadType | null>(null);
  if (!devotion) return null;

  const note = ROSARY_BEADS[slug];
  const title = devotion === "chaplet" ? "On the chaplet beads" : "Where in the Rosary";
  // The other prayers prayed in this devotion — listed so they're reachable
  // without hunting for the right (often un-highlighted) bead.
  const companions = devotionPrayers(devotion).filter((p) => p.slug !== slug);
  const companionsLabel =
    devotion === "chaplet" ? "Prayed with the chaplet" : "Prayed with the Rosary";

  function handlePick(type: BeadType) {
    const prayers = beadPrayers(devotion!, type);
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
        style={{
          letterSpacing: ".16em",
          textTransform: "uppercase",
          fontSize: 10.5,
          fontWeight: 700,
          color: "var(--gold)",
          textAlign: "center",
        }}
      >
        {title}
      </div>
      <RosaryDiagram
        slug={slug}
        devotion={devotion}
        picked={picked}
        onPick={handlePick}
      />
      {note && (
        <p style={{ fontSize: 12.5, color: "var(--ink-soft)", textAlign: "center", marginTop: 6, lineHeight: 1.5 }}>
          {note}
        </p>
      )}
      {picked && (
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 12 }}>
          {beadPrayers(devotion, picked).map((pr) => {
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
      {companions.length > 0 && (
        <div style={{ marginTop: 16, borderTop: "1px solid var(--glass-border)", paddingTop: 14 }}>
          <div
            style={{
              letterSpacing: ".16em",
              textTransform: "uppercase",
              fontSize: 10,
              fontWeight: 700,
              color: "var(--ink-faint)",
              textAlign: "center",
              marginBottom: 10,
            }}
          >
            {companionsLabel}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8 }}>
            {companions.map((pr) => (
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
                  background: "var(--chip-bg)",
                  color: "var(--ink)",
                  border: "1px solid var(--chip-bd)",
                }}
              >
                {pr.title}
                <span aria-hidden>→</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
