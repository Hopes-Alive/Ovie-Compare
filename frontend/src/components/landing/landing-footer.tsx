export function LandingFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Prices and stock are sourced from supplier websites and refreshed
          regularly. Always verify pack sizes and clinical suitability before
          ordering. Ovie Compare is a procurement assistant — not a substitute
          for professional judgment.
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          Data freshness varies by supplier. Use &ldquo;Check live price&rdquo;
          in chat for the latest price before purchasing.
        </p>
      </div>
    </footer>
  );
}
