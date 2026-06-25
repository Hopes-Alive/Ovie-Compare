export const ADAM_DENTAL_BASE = "https://www.adamdental.com.au";

// Selector for the "Show More Products" AJAX button
export const SHOW_MORE_SELECTOR = "button.cv-refresh";

// MVP seed categories — verified leaf paths (fallback if discovery file is missing)
export const SEED_CATEGORIES = [
  {
    name: "Nitrile Gloves",
    path: "/infection-control/gloves/nitrile-gloves",
  },
  {
    name: "Sterilisation Pouches",
    path: "/infection-control/sterilisation/sterilisation-pouches",
  },
  {
    name: "Face Masks Disposable",
    path: "/infection-control/face-masks",
  },
];

// Path segments that are navigation/info pages, not product listings
export const EXCLUDED_SEGMENTS = new Set([
  "search",
  "account",
  "basket",
  "cart",
  "checkout",
  "contact",
  "about",
  "about-us",
  "login",
  "register",
  "logout",
  "sitemap",
  "privacy",
  "privacy-policy",
  "terms",
  "returns",
  "help",
  "news",
  "blog",
  "faq",
  "faqs",
  "careers",
  "specials",
  "equipment",       // equipment pages link out to external booking/quote forms
  "newsletter",
  "thank-you",
  "forgot-password",
  "track-order",
  "order-templates",
  "favourites",
  "prior-purchases",
  "compare",
  "documents",
]);
