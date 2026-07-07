export type InlineTextRun = {
  text: string;
  bold: boolean;
  italic: boolean;
};

export function parseInlineTextRuns(text: string): InlineTextRun[] {
  const runs: InlineTextRun[] = [];
  let buffer = "";
  let bold = false;
  let italic = false;

  function flush() {
    if (!buffer) {
      return;
    }

    runs.push({ text: buffer, bold, italic });
    buffer = "";
  }

  for (let index = 0; index < text.length; index += 1) {
    if (text.startsWith("**", index)) {
      flush();
      bold = !bold;
      index += 1;
      continue;
    }

    if (text[index] === "*") {
      flush();
      italic = !italic;
      continue;
    }

    buffer += text[index];
  }

  flush();
  return runs;
}
