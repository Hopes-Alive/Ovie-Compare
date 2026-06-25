export const ROUTES = {
  home: "/",
  chat: "/chat",
  demo: "/demo",
  admin: {
    overview: "/admin",
    suppliers: "/admin/suppliers",
    analytics: "/admin/analytics",
    jobs: "/admin/jobs",
    architecture: "/admin/architecture",
  },
} as const;

export function getChatUrlFromEnv(): string {
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const path = process.env.NEXT_PUBLIC_CHAT_PATH ?? ROUTES.chat;
  return `${origin}${path}`;
}

export function getChatUrl(baseUrl?: string): string {
  const origin =
    baseUrl ??
    (typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
  const path = process.env.NEXT_PUBLIC_CHAT_PATH ?? ROUTES.chat;
  return `${origin}${path}`;
}
