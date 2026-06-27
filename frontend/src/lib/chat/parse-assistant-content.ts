export type ParsedAssistantContent = {
  takeaway: string | null;
  body: string;
};

function isListLine(line: string): boolean {
  const t = line.trim();
  return t.startsWith("-") || t.startsWith("*") || /^\d+\./.test(t);
}

/** Split LLM markdown into a headline takeaway and remaining detail. Preserves ** markdown. */
export function parseAssistantContent(content: string): ParsedAssistantContent {
  const trimmed = content.trim();
  if (!trimmed) return { takeaway: null, body: "" };

  const lines = trimmed.split("\n");
  const firstLine = lines[0]?.trim() ?? "";

  // Entire first line is bold → summary headline
  const boldLineMatch = firstLine.match(/^\*\*(.+)\*\*$/);
  if (boldLineMatch) {
    return {
      takeaway: firstLine,
      body: lines.slice(1).join("\n").trim(),
    };
  }

  // Bold prefix then rest on same line: **Summary.** Details...
  const inlineBold = trimmed.match(/^\*\*(.+?)\*\*(\s*[.:!—–-]?\s*)([\s\S]*)$/);
  if (inlineBold && inlineBold[3]?.trim()) {
    return {
      takeaway: `**${inlineBold[1]!.trim()}**`,
      body: inlineBold[3]!.trim(),
    };
  }

  // First paragraph is a short prose summary (no list)
  const paraBreak = trimmed.indexOf("\n\n");
  if (paraBreak > 0) {
    const firstPara = trimmed.slice(0, paraBreak).trim();
    if (firstPara.length <= 220 && !isListLine(firstPara) && !firstPara.includes("\n")) {
      const body = trimmed.slice(paraBreak).trim();
      // If first para is already partially bold, keep markdown; else wrap isn't needed
      const takeaway = firstPara.includes("**") ? firstPara : firstPara;
      return { takeaway, body };
    }
  }

  // Single block with no clear split
  if (!trimmed.includes("\n\n") && !isListLine(trimmed) && trimmed.length <= 220) {
    return { takeaway: trimmed.includes("**") ? trimmed : null, body: trimmed.includes("**") ? "" : trimmed };
  }

  return { takeaway: null, body: trimmed };
}
