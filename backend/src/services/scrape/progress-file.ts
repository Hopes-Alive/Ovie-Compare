import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";

export function loadProgressSet(filePath: string): Set<string> {
  if (!existsSync(filePath)) return new Set();
  try {
    const data = JSON.parse(readFileSync(filePath, "utf-8")) as string[];
    return new Set(data);
  } catch {
    return new Set();
  }
}

export function saveProgressSet(filePath: string, done: Set<string>): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify([...done], null, 2), "utf-8");
}

export function clearProgressSet(filePath: string): void {
  saveProgressSet(filePath, new Set());
}
