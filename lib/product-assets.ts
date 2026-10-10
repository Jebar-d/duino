import type { SyntheticEvent } from "react";

const legacyAssetBase =
  "https://tyhocgrjwxswxzzfvwct.supabase.co/storage/v1/object/public/models";

export function getLegacyProductAssetUrl(assetUrl: string | null | undefined) {
  if (!assetUrl) {
    return null;
  }

  try {
    const url = new URL(assetUrl);
    const match = url.pathname.match(
      /\/arduino-store\/backend\/uploads\/(?:products|models)\/([^/]+)$/i,
    );

    return match
      ? `${legacyAssetBase}/${encodeURIComponent(match[1])}`
      : null;
  } catch {
    return null;
  }
}

export function getPreferredProductAssetUrl(
  assetUrl: string | null | undefined,
) {
  if (!assetUrl) {
    return null;
  }

  const legacyUrl = getLegacyProductAssetUrl(assetUrl);
  const fileName = assetUrl.split(/[?#]/, 1)[0].split("/").pop() || "";

  return legacyUrl &&
    /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}\.(?:jpe?g|png|webp|glb)$/i.test(
      fileName,
    )
    ? legacyUrl
    : assetUrl;
}

export function getProductImageUrl(imageUrl: string | null | undefined) {
  return getPreferredProductAssetUrl(imageUrl) || "/product.png";
}

export function getModelUrl(product: {
  slug: string;
  model_url?: string | null;
}) {
  const modelUrl = product.model_url?.trim() ?? "";

  if (modelUrl && /\.glb(?:[?#].*)?$/i.test(modelUrl)) {
    return modelUrl;
  }

  if (!modelUrl) {
    if (product.slug === "arduino-uno") {
      return "/arduino_uno_board.glb";
    }

    if (product.slug === "mb-102-breadboard") {
      return "/arduino_breadboard_-_low_poly.glb";
    }
  }

  return null;
}

export function getPreferredProductModelUrl(modelUrl: string) {
  return getPreferredProductAssetUrl(modelUrl) || modelUrl;
}

export function handleProductImageError(
  event: SyntheticEvent<HTMLImageElement>,
) {
  const image = event.currentTarget;
  const legacyUrl = getLegacyProductAssetUrl(image.src);

  if (legacyUrl && image.dataset.legacyFallbackTried !== "true") {
    image.dataset.legacyFallbackTried = "true";
    image.src = legacyUrl;
    return;
  }

  if (
    image.dataset.placeholderFallbackTried !== "true" &&
    !image.src.endsWith("/product.png")
  ) {
    image.dataset.placeholderFallbackTried = "true";
    image.src = "/product.png";
  }
}
