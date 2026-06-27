"use client";

import { useCallback, useSyncExternalStore } from "react";

import {
  getChatViewLayoutState,
  writeStoredViewMode,
  type ChatViewLayoutState,
  type ChatViewMode,
} from "@/lib/chat-design/chat-view-mode";

const SERVER_SNAPSHOT: ChatViewLayoutState = {
  layout: "desktop",
  viewMode: "wide",
  canToggle: true,
  isWide: true,
};

const listeners = new Set<() => void>();
let cachedSnapshot: ChatViewLayoutState | null = null;

function notify() {
  listeners.forEach((l) => l());
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("resize", onChange, { passive: true });
  window.addEventListener("orientationchange", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("resize", onChange);
    window.removeEventListener("orientationchange", onChange);
  };
}

function getSnapshot(): ChatViewLayoutState {
  const next = getChatViewLayoutState(
    navigator.userAgent,
    window.matchMedia("(orientation: portrait)").matches
  );
  if (
    cachedSnapshot &&
    cachedSnapshot.layout === next.layout &&
    cachedSnapshot.viewMode === next.viewMode &&
    cachedSnapshot.canToggle === next.canToggle &&
    cachedSnapshot.isWide === next.isWide
  ) {
    return cachedSnapshot;
  }
  cachedSnapshot = next;
  return next;
}

export function useChatViewMode() {
  const state = useSyncExternalStore(subscribe, getSnapshot, () => SERVER_SNAPSHOT);

  const setViewMode = useCallback(
    (mode: ChatViewMode) => {
      if (!state.canToggle) return;
      writeStoredViewMode(mode);
      notify();
    },
    [state.canToggle]
  );

  const toggleViewMode = useCallback(() => {
    setViewMode(state.isWide ? "narrow" : "wide");
  }, [state.isWide, setViewMode]);

  return { ...state, setViewMode, toggleViewMode };
}
