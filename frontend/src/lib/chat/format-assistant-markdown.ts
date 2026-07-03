/**
 * Light normalisation so LLM markdown renders with consistent hierarchy.
 */
export function normalizeAssistantMarkdown(content: string): string {
  let text = content.trim();

  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.replace(/^(\*\*.+\*\*)\n(?!\n)/m, "$1\n\n");

  // Remove space before punctuation after bold/highlight spans
  text = text.replace(/\*\*([^*]+)\*\*\s+([,;.!?])/g, "**$1**$2");

  // Prices should not be bold — UI highlights them automatically
  text = text.replace(/\*\*(AUD\s*[\d,.]+)\*\*/gi, "$1");
  text = text.replace(/\*\*(\$[\d,.]+)\*\*/g, "$1");

  text = text.replace(
    /Want me to check a live price\??/gi,
    "You can check current price and stock anytime by clicking Check current status on the product cards below."
  );

  return text;
}

export function isBoldSummaryLine(line: string): boolean {
  return /^\*\*.+\*\*$/.test(line.trim());
}

export function stripOuterBold(text: string): string {
  return text.replace(/^\*\*([\s\S]+)\*\*$/, "$1").trim();
}

export function splitFollowUp(body: string): { main: string; followUp: string | null } {
  const trimmed = body.trim();
  if (!trimmed) return { main: "", followUp: null };

  const blocks = trimmed.split(/\n\n+/);
  const last = blocks[blocks.length - 1]?.trim() ?? "";

  const isFollowUp =
    last.length < 180 &&
    !last.startsWith("-") &&
    !last.startsWith("*") &&
    !/^\d+\./.test(last) &&
    (/^(Want|Would|Need|Can I|Should|Let me know|I can|Happy to|You can)/i.test(last) ||
      (/check current status|check live price/i.test(last) && blocks.length > 1) ||
      (last.endsWith("?") && blocks.length > 1));

  if (isFollowUp) {
    return {
      main: blocks.slice(0, -1).join("\n\n").trim(),
      followUp: last,
    };
  }

  return { main: trimmed, followUp: null };
}
