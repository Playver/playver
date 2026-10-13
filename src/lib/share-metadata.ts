// Link-preview metadata (Open Graph + Twitter card) for shareable pages —
// what WhatsApp, iMessage, Facebook, X, Slack etc. show when someone pastes
// a Playver link. Relative image/URL paths resolve against metadataBase
// (src/app/layout.tsx). Staging sits behind Basic Auth, so preview bots
// can't read it there; previews only render for production links.
import type { Metadata } from "next";

const FALLBACK_IMAGE = "/logo.png";

export function shareMetadata({
  title,
  description,
  image,
  path,
  type = "website",
}: {
  title: string;
  description?: string | null;
  image?: string | null;
  path: string;
  type?: "website" | "profile" | "article";
}): Metadata {
  const desc = (description ?? "").replace(/\s+/g, " ").trim().slice(0, 200) || undefined;
  const images = [{ url: image || FALLBACK_IMAGE }];
  return {
    title: `${title} · Playver`,
    description: desc,
    openGraph: { title, description: desc, url: path, siteName: "Playver", type, images },
    twitter: { card: image ? "summary_large_image" : "summary", title, description: desc, images: images.map((i) => i.url) },
  };
}
