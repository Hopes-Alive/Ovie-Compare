import { ChatLayout } from "@/components/chat/chat-layout";

export default function ChatRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ChatLayout>{children}</ChatLayout>;
}
