export type ChatViewMode = "narrow" | "wide";

export type ChatLayoutContext = "portrait-phone" | "phone-landscape" | "desktop";

const STORAGE_KEY = "ovie:chatViewMode:v1";

const PHONE_UA =
  /iPhone|iPod|Android.*Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i;

export type ChatViewLayoutState = {
  layout: ChatLayoutContext;
  viewMode: ChatViewMode;
  canToggle: boolean;
  isWide: boolean;
};

export function isPhoneUserAgent(userAgent: string): boolean {
  return PHONE_UA.test(userAgent);
}

export function getChatLayoutContext(userAgent: string, portrait: boolean): ChatLayoutContext {
  if (isPhoneUserAgent(userAgent) && portrait) return "portrait-phone";
  if (isPhoneUserAgent(userAgent)) return "phone-landscape";
  return "desktop";
}

export function readStoredViewMode(): ChatViewMode | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "wide" || stored === "narrow" ? stored : null;
}

export function writeStoredViewMode(mode: ChatViewMode): void {
  localStorage.setItem(STORAGE_KEY, mode);
}

export function getChatViewLayoutState(
  userAgent: string,
  portrait: boolean
): ChatViewLayoutState {
  const layout = getChatLayoutContext(userAgent, portrait);
  const canToggle = layout !== "portrait-phone";
  const stored = canToggle ? readStoredViewMode() : null;
  const viewMode = canToggle ? (stored ?? "wide") : "wide";
  return {
    layout,
    viewMode,
    canToggle,
    isWide: viewMode === "wide",
  };
}

export function getChatPanelClasses(isWide: boolean, layout: ChatLayoutContext): string {
  const base =
    "chat-panel relative z-10 flex h-full w-full flex-col overflow-hidden transition-[max-width,border-radius,box-shadow] duration-300 ease-out";

  if (layout === "portrait-phone") {
    return `${base} max-w-none rounded-none shadow-none`;
  }

  if (isWide && layout === "desktop") {
    return `${base} max-w-[min(1280px,calc(100vw-2rem))] rounded-[1.125rem] shadow-2xl`;
  }

  if (layout === "desktop") {
    return `${base} max-w-[430px] rounded-[2rem] shadow-2xl`;
  }

  return `${base} max-w-[430px] rounded-[1.25rem] shadow-2xl m-3 w-[calc(100%-1.5rem)] h-[calc(100%-1.5rem)]`;
}

export function shouldShowWideBackdrop(isWide: boolean, layout: ChatLayoutContext): boolean {
  return isWide && layout === "desktop";
}

/** Static view-mode snapshots for the admin design preview */
export function getPreviewViewMode(mode: "mobile" | "desktop"): ChatViewLayoutState & {
  setViewMode: (mode: ChatViewMode) => void;
  toggleViewMode: () => void;
} {
  const noopMode = (_mode: ChatViewMode) => {};

  if (mode === "mobile") {
    return {
      layout: "portrait-phone",
      viewMode: "wide",
      canToggle: false,
      isWide: true,
      setViewMode: noopMode,
      toggleViewMode: () => {},
    };
  }

  return {
    layout: "desktop",
    viewMode: "wide",
    canToggle: true,
    isWide: true,
    setViewMode: noopMode,
    toggleViewMode: () => {},
  };
}
