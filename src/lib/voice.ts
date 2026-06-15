/* ------------------------------------------------------------------ *
 * Pre-generated narration voices (OpenAI TTS). Audio is generated once
 * per segment per voice into /public/audio/<voice>/<slug>-<order>.mp3
 * (see scripts/generate-audio.mjs) and played by useSpeech, which falls
 * back to the browser's speech synthesis if a file is missing.
 * ------------------------------------------------------------------ */
export type VoiceId = "onyx" | "shimmer";

export const VOICES: { id: VoiceId; label: string }[] = [
  { id: "onyx", label: "Male" },
  { id: "shimmer", label: "Female" },
];

export const DEFAULT_VOICE: VoiceId = "onyx";

/** Path to a segment's pre-generated clip. Keyed by slug+order so it survives re-seeds. */
export function audioSrc(slug: string, order: number, voice: VoiceId): string {
  return `/audio/${voice}/${slug}-${order}.mp3`;
}

/**
 * The chosen voice "leads" — used for Caller/solo/unison lines. In a
 * call-and-response prayer the Responder lines speak in the other voice.
 */
export function voiceForSegment(
  primary: VoiceId,
  dialogic: boolean,
  role: string,
): VoiceId {
  const other: VoiceId = primary === "onyx" ? "shimmer" : "onyx";
  return dialogic && role === "RESPONDER" ? other : primary;
}
