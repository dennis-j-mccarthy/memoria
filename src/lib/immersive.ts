import { getContentSets } from "@/lib/content";

/* Maps the canonical prayer data (DB) into the shape the immersive app uses. */

const ICONS: Record<string, string> = {
  "sign-of-the-cross": "cross",
  "our-father": "cross",
  "hail-mary": "flower",
  "glory-be": "flame",
  "o-my-jesus": "hands",
  "apostles-creed": "book",
  "hail-holy-queen": "flower",
  "joyful-mysteries": "flower",
  "concluding-prayer": "hands",
  "the-angelus": "flower",
  "grace-before-meals": "hands",
  "guardian-angel-prayer": "flower",
  "act-of-contrition": "hands",
  "st-michael": "cross",
  "divine-mercy-chaplet": "flame",
};

export interface ImmersiveLine {
  id: string;
  role: "L" | "R";
  text: string;
  anchors: number[];
  order: number;
}

export interface ImmersivePrayer {
  slug: string;
  title: string;
  sub: string | null;
  cr: boolean;
  icon: string;
  dur: string;
  durSec: number;
  language: string;
  section: string;
  lines: ImmersiveLine[];
}

function wordCount(lines: ImmersiveLine[]): number {
  return lines.reduce(
    (n, l) => n + l.text.split(/\s+/).filter(Boolean).length,
    0,
  );
}

/** All prayers, in catalog order, mapped for the immersive app. */
export async function getAllPrayers(): Promise<ImmersivePrayer[]> {
  const sets = await getContentSets();
  const out: ImmersivePrayer[] = [];
  for (const set of sets) {
    for (const p of set.passages) {
      const lines: ImmersiveLine[] = p.segments.map((s) => ({
        id: s.id,
        role: s.role === "RESPONDER" ? "R" : "L",
        text: s.text,
        anchors: s.connectiveIndices,
        order: s.order,
      }));
      const sec = Math.max(20, Math.round(wordCount(lines) / 2.2));
      const dur =
        sec < 60 ? `${Math.round(sec / 5) * 5} sec` : `${Math.round(sec / 60)} min`;
      out.push({
        slug: p.slug,
        title: p.title,
        sub: p.source,
        cr: p.dialogic,
        icon: ICONS[p.slug] ?? "cross",
        dur,
        durSec: sec,
        language: p.language,
        section: set.title,
        lines,
      });
    }
  }
  return out;
}
