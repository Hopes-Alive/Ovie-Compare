type AnalyticsPanelProps = {
  title: string;
  children: React.ReactNode;
};

export function AnalyticsPanel({ title, children }: AnalyticsPanelProps) {
  return (
    <div className="rounded-2xl border border-[#E5E3DF] bg-white transition-colors duration-300 hover:border-[#D9D6D2]">
      <div className="border-b border-[#F7F5F0] px-5 py-4">
        <h3 className="text-[16px] font-semibold text-[#1A1A1A]">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}
