import { Fragment } from "react";

interface Props {
  text: string;
  /** word indices to highlight as connective-tissue anchors */
  anchorIndices?: number[];
  /** when false, render plain text (highlighting toggled off) */
  highlight?: boolean;
  /** when provided, each word becomes a button that toggles its anchor */
  onToggleWord?: (index: number) => void;
}

/**
 * Renders a line of recited text, optionally highlighting its anchor words as
 * memory scaffolding. When `onToggleWord` is given the words become clickable
 * so the reader can choose their own anchors. Splitting on whitespace keeps
 * word indices aligned with the seed's connectiveIndices.
 */
export function ConnectiveText({
  text,
  anchorIndices = [],
  highlight = true,
  onToggleWord,
}: Props) {
  const editable = Boolean(onToggleWord);

  // Nothing to do: not editing and no highlighting to draw.
  if (!editable && (!highlight || anchorIndices.length === 0)) {
    return <>{text}</>;
  }

  const set = new Set(anchorIndices);
  // Split on whitespace but keep the separators so spacing is preserved.
  // Pre-compute each token's word index (null for whitespace tokens) so the
  // render pass stays free of mutable counters.
  const tokens = text.split(/(\s+)/);
  const wordIndexByToken: (number | null)[] = [];
  let counter = -1;
  for (const token of tokens) {
    if (/^\s+$/.test(token) || token === "") {
      wordIndexByToken.push(null);
    } else {
      counter += 1;
      wordIndexByToken.push(counter);
    }
  }

  return (
    <>
      {tokens.map((token, i) => {
        const wordIndex = wordIndexByToken[i];
        if (wordIndex === null) {
          return <Fragment key={i}>{token}</Fragment>;
        }
        const isAnchor = highlight && set.has(wordIndex);

        if (editable) {
          return (
            <button
              key={i}
              type="button"
              onClick={() => onToggleWord!(wordIndex)}
              className={`word-toggle ${isAnchor ? "anchor-on" : "anchor-off"}`}
              aria-label={
                isAnchor
                  ? `${token} — anchor, tap to remove`
                  : `${token} — tap to make an anchor`
              }
            >
              {token}
            </button>
          );
        }

        if (isAnchor) {
          return (
            <span key={i} className="connective">
              {token}
            </span>
          );
        }
        return <Fragment key={i}>{token}</Fragment>;
      })}
    </>
  );
}
