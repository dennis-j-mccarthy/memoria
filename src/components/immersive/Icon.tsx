/* Stroke icon set ported from the Hallow prototype. viewBox 24, 1.7 stroke. */
const PATHS: Record<string, string[]> = {
  flower: [
    "M12 11.5V20",
    "M12 15c-2 0-3.6-1-4.4-2.4",
    "M12 17c2 0 3.6-1 4.4-2.4",
  ],
  cross: ["M12 3v18M6.5 9h11"],
  flame: [
    "M12 3c1 4 4.5 5.2 4.5 9a4.5 4.5 0 0 1-9 0c0-2 1-3 1.5-4 .8 1 1.6.6 1.6-.6C11.6 5.6 11.5 4.4 12 3Z",
  ],
  hands: ["M12 4c-2 4-3 7-3 10l3 3 3-3c0-3-1-6-3-10Z", "M9 14l-2 1.5M15 14l2 1.5"],
  book: ["M5 5h7v15H6a1 1 0 0 1-1-1Z", "M12 5h7v14a1 1 0 0 1-1 1h-6Z"],
  chevdown: ["M6 9l6 6 6-6"],
  chevleft: ["M15 6l-6 6 6 6"],
  voices: ["M11 5 6 9H3v6h3l5 4V5Z", "M16 9a3 3 0 0 1 0 6"],
  prev: ["M11 6 4 12l7 6V6Z", "M20 6l-7 6 7 6V6Z"],
  next: ["M13 6l7 6-7 6V6Z", "M4 6l7 6-7 6V6Z"],
  bookmark: ["M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z"],
  moon: ["M20 14.5A8 8 0 0 1 9.5 4 7 7 0 1 0 20 14.5Z"],
  check: ["M5 12l5 5 9-10"],
  pray: ["M12 4c-2 4-3 7-3 10l3 3 3-3c0-3-1-6-3-10Z", "M9 14l-2 1.5M15 14l2 1.5"],
};

// Icons with circles need bespoke rendering.
export function Icon({
  name,
  size = 20,
  color = "currentColor",
}: {
  name: string;
  size?: number;
  color?: string;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (name === "flower") {
    return (
      <svg {...common}>
        {PATHS.flower.map((d, i) => (
          <path key={i} d={d} />
        ))}
        <circle cx={12} cy={8} r={3.2} />
      </svg>
    );
  }
  if (name === "target") {
    return (
      <svg {...common}>
        <circle cx={12} cy={12} r={8.5} />
        <circle cx={12} cy={12} r={4} />
        <circle cx={12} cy={12} r={0.6} fill={color} />
      </svg>
    );
  }
  if (name === "user" || name === "you") {
    return (
      <svg {...common}>
        <circle cx={12} cy={8} r={3.4} />
        <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
      </svg>
    );
  }
  if (name === "sun") {
    return (
      <svg {...common}>
        <circle cx={12} cy={12} r={4} />
        <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M19.4 4.6l-1.8 1.8M6.4 17.6l-1.8 1.8" />
      </svg>
    );
  }
  const paths = PATHS[name] ?? PATHS.cross;
  return (
    <svg {...common}>
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

export function PlayGlyph({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size * 1.1} viewBox="0 0 17 19" fill={color} aria-hidden>
      <path d="M0 0l17 9.5L0 19z" />
    </svg>
  );
}

export function PauseGlyph({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 20" fill={color} aria-hidden>
      <rect x={1} y={1} width={5} height={18} rx={1.5} />
      <rect x={12} y={1} width={5} height={18} rx={1.5} />
    </svg>
  );
}
