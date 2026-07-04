export function PaperSketchBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-[#faf6ec]">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, transparent 0 35px, rgba(120, 113, 90, 0.14) 35px 36px)",
        }}
      />
      <div className="absolute inset-y-0 left-16 hidden w-px bg-rose-300/40 sm:block" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(0,0,0,0)_0%,_rgba(120,113,90,0.08)_100%)]" />

      <svg
        className="absolute top-[12%] left-[6%] size-24 -rotate-6 text-stone-400/40 sm:size-32"
        viewBox="0 0 100 100"
        fill="none"
      >
        <circle
          cx="50"
          cy="50"
          r="38"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="4 5"
          strokeLinecap="round"
        />
      </svg>
      <svg
        className="absolute top-[20%] right-[8%] size-16 rotate-12 text-stone-400/40 sm:size-24"
        viewBox="0 0 100 40"
        fill="none"
      >
        <path
          d="M2 30 Q 25 2, 50 20 T 98 12"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <svg
        className="absolute bottom-[12%] left-[12%] size-20 rotate-3 text-stone-400/30 sm:size-28"
        viewBox="0 0 100 100"
        fill="none"
      >
        <rect
          x="10"
          y="10"
          width="80"
          height="80"
          rx="6"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="3 6"
        />
      </svg>
      <svg
        className="absolute right-[10%] bottom-[18%] size-24 -rotate-6 text-stone-400/30 sm:size-32"
        viewBox="0 0 100 100"
        fill="none"
      >
        <path
          d="M20 80 C 10 40, 40 15, 55 10 S 90 25, 82 55"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M82 55 l -10 -4 M82 55 l -3 -10"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
