const NARROW_CARD_WIDTH = 430;
const MAX_CONTAIN_BANNER_HEIGHT = 320;
const EXPANDED_DEFAULT_BANNER_HEIGHT = 128;
const EXPANDED_MAX_BANNER_HEIGHT = 148;
const EXPANDED_MIN_BANNER_HEIGHT = 96;
const EXPANDED_HEIGHT_SCALE = 0.62;

export function computeBannerHeight(
  img: HTMLImageElement,
  headerWidth: number
): number | null {
  const { naturalWidth, naturalHeight } = img;
  if (naturalWidth <= 0 || naturalHeight <= 0) return null;
  const referenceWidth = Math.min(headerWidth, NARROW_CARD_WIDTH);
  return Math.round(referenceWidth * (naturalHeight / naturalWidth));
}

export function clampContainBannerHeight(height: number): number {
  return Math.min(Math.max(height, 120), MAX_CONTAIN_BANNER_HEIGHT);
}

export function clampCoverBannerHeight(containHeight: number): number {
  const scaled = Math.round(containHeight * EXPANDED_HEIGHT_SCALE);
  return Math.min(
    Math.max(scaled, EXPANDED_MIN_BANNER_HEIGHT),
    EXPANDED_MAX_BANNER_HEIGHT
  );
}

export function resolveCoverBannerHeight(
  lockedContainHeight: number | null,
  computed: number | null
): number {
  const base =
    lockedContainHeight ??
    computed ??
    EXPANDED_DEFAULT_BANNER_HEIGHT;
  return clampCoverBannerHeight(base);
}
