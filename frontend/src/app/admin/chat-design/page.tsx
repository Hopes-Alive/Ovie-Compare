import type { Metadata } from "next";

import { ChatDesignEditor } from "@/components/admin/chat-design-editor";

export const metadata: Metadata = {
  title: "Chat Design | Ovie Admin",
};

export default function AdminChatDesignPage() {
  return <ChatDesignEditor />;
}
