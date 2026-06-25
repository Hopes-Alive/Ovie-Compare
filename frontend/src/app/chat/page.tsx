import type { Metadata } from "next";

import { ChatPageContent } from "@/components/chat/chat-page-content";

export const metadata: Metadata = {
  title: "Chat | Ovie Compare",
  description: "Compare dental supplies across Australian suppliers",
};

export default function ChatPage() {
  return <ChatPageContent />;
}
