import { Fragment } from "react";

interface Props {
  text: string;
  /** word indices to highlight as connective-tissue anchors */
  connectiveIndices?: number[];
  /** when false, render plain text (highlighting toggled off) */
  highlight?: boolean;
}

/**
 * Renders a line of recited text, optionally highlighting its connective
 * words (prepositions/conjunctions/relatives) as memory anchors. Splitting on
 * whitespace keeps word indices aligned with the seed's connectiveIndices.
 */
export function ConnectiveText({
  text,
  connectiveIndices = [],
  highlight = true,
}: Props) {
  if (!highlight || connectiveIndices.length === 0) {
    return <>{text}</>;
  }
  const set = new Set(connectiveIndices);
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
        if (wordIndex !== null && set.has(wordIndex)) {
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
