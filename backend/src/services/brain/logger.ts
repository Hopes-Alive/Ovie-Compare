/**
 * Structured ANSI terminal logger for the brain pipeline.
 * Outputs step banners, timings, and key values to stdout only.
 */

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const MAGENTA = "\x1b[35m";
const BLUE = "\x1b[34m";

function now(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function pad(s: string, width: number): string {
  return s.length >= width ? s : s + " ".repeat(width - s.length);
}

export function logPipelineStart(message: string): void {
  const line = "═".repeat(50);
  console.log(`\n${CYAN}${BOLD}╔${line}╗${RESET}`);
  console.log(`${CYAN}${BOLD}║${RESET}  ${BOLD}OVIE BRAIN${RESET}  ·  ${DIM}${now()}${RESET}${" ".repeat(Math.max(0, 48 - now().length - 14))}${CYAN}${BOLD}║${RESET}`);
  console.log(`${CYAN}${BOLD}╚${line}╝${RESET}`);
  console.log(`  ${DIM}user:${RESET} ${JSON.stringify(message.slice(0, 80))}${message.length > 80 ? "..." : ""}`);
}

export function logPipelineEnd(meta: {
  totalMs: number;
  matched: number;
  presented: number;
  fallback: boolean;
}): void {
  const line = "─".repeat(50);
  console.log(`\n${CYAN}${line}${RESET}`);
  const fallbackTag = meta.fallback ? `  ${YELLOW}[fallback]${RESET}` : "";
  console.log(
    `  ${BOLD}TOTAL${RESET}  ${GREEN}${meta.totalMs}ms${RESET}  ·  ${MAGENTA}${meta.matched} matched${RESET}  ·  ${BLUE}${meta.presented} presented${RESET}${fallbackTag}`
  );
  console.log(`${CYAN}${line}${RESET}\n`);
}

export function logStepStart(step: number, total: number, name: string): void {
  console.log(`\n  ${CYAN}►${RESET} ${BOLD}[${step}/${total}]${RESET} ${name}`);
}

export function logStepDetail(key: string, value: unknown): void {
  const k = pad(key, 10);
  const v =
    typeof value === "object"
      ? JSON.stringify(value)
      : String(value).slice(0, 120);
  console.log(`      ${DIM}${k}${RESET}: ${v}`);
}

export function logStepDone(step: number, total: number, ms: number, note?: string): void {
  const noteStr = note ? `  ${DIM}${note}${RESET}` : "";
  console.log(`  ${GREEN}✔${RESET}  ${DIM}[${step}/${total}] done${RESET}  ${GREEN}(${ms}ms)${RESET}${noteStr}`);
}

export function logStepError(step: number, total: number, err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  console.log(`  ${RED}✖${RESET}  ${DIM}[${step}/${total}] error${RESET}  ${RED}${msg}${RESET}`);
}

export function logInfo(msg: string): void {
  console.log(`  ${DIM}│${RESET} ${msg}`);
}

/** Convenience: start a step timer, returns a done() callback */
export function stepTimer(): () => number {
  const start = Date.now();
  return () => Date.now() - start;
}
