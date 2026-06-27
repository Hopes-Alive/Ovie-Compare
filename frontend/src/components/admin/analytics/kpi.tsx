type KpiProps = {
  title: string;
  value: React.ReactNode;
  description?: string;
};

export function AnalyticsKpi({ title, value, description }: KpiProps) {
  return (
    <div className="rounded-2xl border border-[#E5E3DF] bg-white p-5 transition-colors duration-300 hover:border-[#D9D6D2]">
      <p className="mb-2 text-[13px] font-medium text-[#A8A39B]">{title}</p>
      <div className="text-[28px] font-semibold tracking-[-0.02em] text-[#1A1A1A] tabular-nums">
        {value}
      </div>
      {description && (
        <p className="mt-1.5 text-[12px] text-[#A8A39B]">{description}</p>
      )}
    </div>
  );
}
