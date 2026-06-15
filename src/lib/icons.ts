import { normalizeWord } from "@/lib/recite";

/* ------------------------------------------------------------------ *
 * Word → emoji memory hooks for Icons mode. Keyed by normalized word
 * (lowercase, no punctuation/diacritics). Only evocative "key words"
 * are mapped; everything else stays a blank you recite. Plurals/variants
 * are listed explicitly where they occur in the prayers.
 * ------------------------------------------------------------------ */
const ICONS: Record<string, string> = {
  // God & heaven
  god: "🙏",
  father: "👨",
  son: "🧒",
  spirit: "🕊️",
  holy: "🕊️",
  lord: "✝️",
  jesus: "✝️",
  christ: "✝️",
  heaven: "☁️",
  heavenly: "☁️",
  glory: "✨",
  hallowed: "✨",
  // Kingdom / earth / world
  kingdom: "👑",
  king: "👑",
  queen: "👑",
  earth: "🌍",
  world: "🌍",
  // Our Father imagery
  name: "📛",
  bread: "🍞",
  daily: "🍞",
  trespasses: "⚖️",
  temptation: "🍎",
  evil: "👿",
  devil: "👿",
  satan: "👿",
  hell: "🔥",
  fires: "🔥",
  // Mary / Hail Mary / Rosary
  mary: "🌹",
  grace: "💫",
  blessed: "🙌",
  womb: "🤰",
  mother: "🤱",
  death: "⚰️",
  hour: "⏳",
  mercy: "💗",
  sinners: "🙇",
  sins: "🙇",
  // Creed
  creator: "🌟",
  almighty: "💪",
  conceived: "👼",
  virgin: "🌹",
  crucified: "✝️",
  buried: "⚰️",
  rose: "🌅",
  ascended: "⬆️",
  judge: "⚖️",
  resurrection: "🌅",
  life: "🌱",
  everlasting: "♾️",
  church: "⛪",
  saints: "😇",
  // Angels / St Michael / Guardian Angel
  angel: "👼",
  archangel: "👼",
  michael: "🛡️",
  battle: "⚔️",
  defend: "🛡️",
  defense: "🛡️",
  guard: "🛡️",
  guide: "🧭",
  light: "🕯️",
  souls: "💠",
  // Mysteries
  annunciation: "📜",
  visitation: "🤝",
  nativity: "👶",
  presentation: "🕊️",
  temple: "🏛️",
  // Closing
  amen: "🙏",
  cross: "✝️",
  bless: "🙌",
};

/** The emoji hook for a word, or null if it isn't a mapped key word. */
export function iconFor(word: string): string | null {
  return ICONS[normalizeWord(word)] ?? null;
}
