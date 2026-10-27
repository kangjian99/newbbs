export type Edit = { text: string; start: number; end: number };

export function wrapSelection(text: string, start: number, end: number, before: string, after: string, placeholder: string): Edit {
  const selected = text.slice(start, end);
  const alreadyWrapped = text.slice(start - before.length, start) === before && text.slice(end, end + after.length) === after;
  if (alreadyWrapped && selected) {
    return {
      text: text.slice(0, start - before.length) + selected + text.slice(end + after.length),
      start: start - before.length,
      end: end - before.length,
    };
  }
  const inner = selected || placeholder;
  const next = text.slice(0, start) + before + inner + after + text.slice(end);
  return { text: next, start: start + before.length, end: start + before.length + inner.length };
}

export function prefixLines(text: string, start: number, end: number, prefix: (index: number) => string, matches: (line: string) => boolean): Edit {
  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const nextBreak = text.indexOf("\n", end);
  const lineEnd = nextBreak === -1 ? text.length : nextBreak;
  const lines = text.slice(lineStart, lineEnd).split("\n");
  const remove = lines.every((line) => matches(line));
  const changed = lines
    .map((line, index) => {
      if (remove) return line.replace(/^(#{1,6}\s+|>\s?|[-*+]\s+|\d+\.\s+)/, "");
      return `${prefix(index)}${line}`;
    })
    .join("\n");
  return { text: text.slice(0, lineStart) + changed + text.slice(lineEnd), start: lineStart, end: lineStart + changed.length };
}

export function insertBlock(text: string, start: number, end: number, snippet: string, selectFrom = 0, selectTo = snippet.length): Edit {
  const before = text.slice(0, start);
  const after = text.slice(end);
  const lead = before.length === 0 || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
  const trail = after.length === 0 || after.startsWith("\n\n") ? "" : after.startsWith("\n") ? "\n" : "\n\n";
  const offset = before.length + lead.length;
  return {
    text: before + lead + snippet + trail + after,
    start: offset + selectFrom,
    end: offset + selectTo,
  };
}

export function insertInline(text: string, start: number, end: number, snippet: string): Edit {
  return { text: text.slice(0, start) + snippet + text.slice(end), start: start + snippet.length, end: start + snippet.length };
}
