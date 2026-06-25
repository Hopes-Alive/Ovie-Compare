type ChatLayoutProps = {
  children: React.ReactNode;
};

export function ChatLayout({ children }: ChatLayoutProps) {
  return (
    <div className="flex h-full min-h-[100dvh] flex-col bg-background">
      {children}
    </div>
  );
}
