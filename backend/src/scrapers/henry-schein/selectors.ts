export const HENRY_SCHEIN_BASE = "https://www.henryschein.com.au";

// MVP categories to seed — verified public, no login required
export const SEED_CATEGORIES = [
  {
    name: "Nitrile & Synthetic Gloves",
    path: "/disposables/gloves/nitrile-and-synthetic-gloves",
  },
  {
    name: "Sterilisation Pouches",
    path: "/infection-control/sterilisation/sterilisation-pouches",
  },
  {
    name: "Composite & Bonding",
    path: "/restorative/composite-and-bonding",
  },
];

import { henryScheinImageUrlsForCode } from "../../lib/product-images.js";

// Product image URL pattern — Henry Schein uses /images/ProductImages/500/{sku}.jpg
export const IMAGE_URL = (sku: string) => henryScheinImageUrlsForCode(sku)[0] ?? "";
