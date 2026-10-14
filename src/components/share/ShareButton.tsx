"use client";

// Share any Playver page (event, tournament, profile, organization, team,
// or a single photo/video). Phones get the native share sheet; elsewhere a
// small menu offers Copy link, WhatsApp, Facebook, X, LinkedIn and Email.
// `path` is locale-less (e.g. "/events/abc") so whoever opens the link gets
// their own language via the locale redirect.
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";

type Variant = "button" | "icon" | "overlay";

export function ShareIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

function canNativeShare() {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") return false;
  // Desktop browsers with navigator.share (Safari, Edge) open a small OS
  // sheet that's easy to miss; the menu is clearer there.
  return window.matchMedia("(pointer: coarse)").matches;
}

export default function ShareButton({
  path,
  title,
  text,
  variant = "button",
  className = "",
  label,
}: {
  path: string;
  title: string;
  text?: string;
  variant?: Variant;
  className?: string;
  label?: string;
}) {
  const t = useTranslations("Share");
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // The menu is portalled to <body> with fixed positioning so it's never
  // clipped by an overflow-hidden parent (e.g. a media tile). It opens
  // towards whichever side of the screen has room.
  function placeMenu() {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const MENU_WIDTH = 224;
    const MENU_HEIGHT = 300;
    const style: CSSProperties = { position: "fixed", width: MENU_WIDTH };
    if (rect.left + MENU_WIDTH <= window.innerWidth - 8) style.left = Math.max(8, rect.left);
    else style.right = Math.max(8, window.innerWidth - rect.right);
    if (rect.bottom + 8 + MENU_HEIGHT <= window.innerHeight || rect.top < MENU_HEIGHT) style.top = rect.bottom + 8;
    else style.bottom = window.innerHeight - rect.top + 8;
    setMenuStyle(style);
  }

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const target = e.target as Node;
      if (ref.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        // Don't let Escape also close a surrounding viewer/dialog.
        e.stopImmediatePropagation();
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey, true);
    // Follow the button when the page scrolls or resizes (including the
    // mobile browser bar collapsing) instead of closing.
    window.addEventListener("resize", placeMenu);
    window.addEventListener("scroll", placeMenu, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", placeMenu);
      window.removeEventListener("scroll", placeMenu, true);
    };
  }, [open]);

  function url() {
    return new URL(path, window.location.origin).toString();
  }

  async function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (canNativeShare()) {
      try {
        await navigator.share({ title, text: text ?? title, url: url() });
        return;
      } catch (err) {
        // Cancelled by the user: nothing to do. Anything else falls back to
        // the menu.
        if ((err as Error).name === "AbortError") return;
      }
    }
    if (!open) placeMenu();
    setOpen((o) => !o);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url());
    } catch {
      window.prompt(t("copyLink"), url());
    }
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      setOpen(false);
    }, 1200);
  }

  function targets() {
    const u = encodeURIComponent(url());
    const msg = encodeURIComponent(text ?? title);
    return [
      { key: "whatsapp", label: "WhatsApp", href: `https://wa.me/?text=${msg}%20${u}` },
      { key: "facebook", label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
      { key: "x", label: "X", href: `https://twitter.com/intent/tweet?text=${msg}&url=${u}` },
      { key: "linkedin", label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
      { key: "email", label: t("email"), href: `mailto:?subject=${encodeURIComponent(title)}&body=${msg}%0A%0A${u}` },
    ];
  }

  const triggerClass =
    variant === "icon"
      ? "w-9 h-9 rounded-full flex items-center justify-center border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
      : variant === "overlay"
        ? "w-8 h-8 rounded-full flex items-center justify-center bg-black/55 text-white hover:bg-black/75"
        : "inline-flex items-center gap-2 px-4 py-2 rounded-full border border-zinc-200 bg-white text-sm font-semibold text-zinc-800 hover:bg-zinc-50";

  return (
    <div ref={ref} className={`inline-flex ${className}`}>
      <button
        type="button"
        onClick={onClick}
        aria-label={label ?? t("share")}
        title={label ?? t("share")}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`${triggerClass} transition-colors`}
      >
        <ShareIcon />
        {variant === "button" && <span>{t("share")}</span>}
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={menuStyle}
          onClick={(e) => e.stopPropagation()}
          className="z-[100] rounded-xl border border-zinc-200 bg-white shadow-xl py-1.5 text-left"
        >
          <button type="button" role="menuitem" onClick={copy} className="w-full text-left px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50">
            {copied ? t("copied") : t("copyLink")}
          </button>
          <div className="h-px bg-zinc-100 my-1" />
          {targets().map((target) => (
            <a
              key={target.key}
              role="menuitem"
              href={target.href}
              target={target.key === "email" ? undefined : "_blank"}
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              {target.label}
            </a>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
