import type { SupplierAdapter } from "../types/scraper.js";
import { HenryScheinAdapter } from "./henry-schein/adapter.js";

const adapters: Record<string, SupplierAdapter> = {
  henry_schein: new HenryScheinAdapter(),
};

export function getAdapter(adapterKey: string): SupplierAdapter {
  const adapter = adapters[adapterKey];
  if (!adapter) {
    throw new Error(`No adapter registered for key: ${adapterKey}`);
  }
  return adapter;
}
