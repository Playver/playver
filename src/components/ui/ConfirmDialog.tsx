"use client";

// Small branded confirmation modal — replaces native window.confirm() for
// flows where a plain browser dialog ("localhost:3000 says...") would break
// the app's look. Controlled by the caller's own `open` state, which always
// starts false, so this never needs the SSR "mounted" guard pattern used by
// always-mounted portals elsewhere (e.g. CreateChooserModal).
import { createPortal } from "react-dom";

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  confirming = false,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirming?: boolean;
}) {
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl flex flex-col gap-4">
        <h2 className="text-lg font-extrabold text-zinc-900">{title}</h2>
        <p className="text-sm text-zinc-600 leading-relaxed">{message}</p>
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={confirming}
            className="px-4 py-2 text-sm font-semibold rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirming}
            className="px-4 py-2 text-sm font-bold text-white rounded-lg bg-[#e21d12] hover:bg-[#d41810] transition-colors disabled:opacity-60"
          >
            {confirming ? "…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
