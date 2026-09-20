"use client";

// Join/leave control on the public event detail page. Three paths depending
// on the event: joinEvent() for free events with no custom form,
// joinEventWithForm() when the organizer configured custom registration
// fields (formFields), and a Stripe/wallet payment flow (see the pay
// handlers further down) when `price` > 0 — availableWalletCents is applied
// as a credit before charging the card.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { joinEvent, leaveEvent, joinEventWithForm } from "@/app/actions/event";
import { useUploadThing } from "@/lib/uploadthing";
import { formatPrice } from "@/lib/format-price";
import type { FormField, FormResponseInput } from "@/app/actions/event";

export default function EventJoinButton({
  eventId,
  isJoined,
  joinLabel,
  leaveLabel,
  price = 0,
  availableWalletCents = 0,
  formFields = [],
  isEnded = false,
}: {
  eventId: string;
  isJoined: boolean;
  joinLabel: string;
  leaveLabel: string;
  price?: number;
  /** Player's spendable wallet balance, applied as a credit toward price. */
  availableWalletCents?: number;
  formFields?: FormField[];
  isEnded?: boolean;
}) {
  const t = useTranslations("EventDetails");
  const [joined, setJoined] = useState(isJoined);
  const [isPending, startTransition] = useTransition();
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showPayConfirm, setShowPayConfirm] = useState(false);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [fileUploading, setFileUploading] = useState<Record<string, boolean>>({});
  const [formError, setFormError] = useState("");
  const [joinError, setJoinError] = useState("");
  const router = useRouter();
  const { startUpload } = useUploadThing("registrationFile");

  const hasForm = formFields.length > 0;
  const walletCredit = Math.min(availableWalletCents, price);
  const amountDueCents = Math.max(0, price - walletCredit);

  async function startPayment(useWallet: boolean) {
    setShowPayConfirm(false);
    setPaymentLoading(true);
    setJoinError("");
    try {
      const res = await fetch("/api/stripe/event-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, useWallet }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setJoinError(data.error ?? t("registrationError"));
        setPaymentLoading(false);
        return;
      }
      if (data.paidByWallet) {
        setJoined(true);
        setPaymentLoading(false);
        router.refresh();
        return;
      }
      window.location.href = data.url;
    } catch {
      setJoinError(t("registrationError"));
      setPaymentLoading(false);
    }
  }

  async function handleJoinClick() {
    if (price > 0) {
      // Wallet balance would otherwise be spent silently on click — give the
      // player an explicit choice whenever there's actually a choice to make
      // (no wallet balance means there's nothing to confirm, it's just a
      // normal card payment).
      if (walletCredit > 0) {
        setJoinError("");
        setShowPayConfirm(true);
        return;
      }
      await startPayment(false);
      return;
    }
    if (hasForm) {
      setResponses({});
      setFormError("");
      setShowModal(true);
    } else {
      startTransition(async () => {
        setJoinError("");
        const result = await joinEvent(eventId);
        if (result.error) {
          setJoinError(result.error);
        } else {
          setJoined(true);
          router.refresh();
        }
      });
    }
  }

  function handleLeaveClick() {
    startTransition(async () => {
      setJoinError("");
      const result = await leaveEvent(eventId);
      if (result.error) {
        setJoinError(result.error);
      } else {
        setJoined(false);
        router.refresh();
      }
    });
  }

  async function handleFileChange(fieldId: string, file: File) {
    setFileUploading(prev => ({ ...prev, [fieldId]: true }));
    try {
      const res = await startUpload([file]);
      const url = res?.[0]?.ufsUrl ?? res?.[0]?.url;
      if (url) setResponses(prev => ({ ...prev, [fieldId]: url }));
    } catch {
      // silently fail; user can retry
    }
    setFileUploading(prev => ({ ...prev, [fieldId]: false }));
  }

  function setResponse(fieldId: string, value: string) {
    setResponses(prev => ({ ...prev, [fieldId]: value }));
  }

  function toggleCheckboxOption(fieldId: string, option: string, checked: boolean) {
    const current = responses[fieldId] ? responses[fieldId].split("|||") : [];
    const updated = checked ? [...current, option] : current.filter(o => o !== option);
    setResponse(fieldId, updated.join("|||"));
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    for (const field of formFields) {
      if (field.required && !responses[field.id]?.trim()) {
        setFormError(`"${field.label}" ${t("registrationFieldRequired")}`);
        return;
      }
    }

    const responseList: FormResponseInput[] = formFields.map(f => ({
      fieldId: f.id,
      value: responses[f.id] ?? "",
    }));

    startTransition(async () => {
      const result = await joinEventWithForm(eventId, responseList);
      if (result.error) {
        setFormError(result.error);
      } else {
        setJoined(true);
        setShowModal(false);
        router.refresh();
      }
    });
  }

  const anyFileUploading = Object.values(fileUploading).some(Boolean);
  const inputClass = "w-full px-4 py-2.5 text-sm bg-white border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-red-200 placeholder:text-zinc-400 text-zinc-800";

  return (
    <>
      {joined ? (
        <button
          type="button"
          onClick={handleLeaveClick}
          disabled={isPending}
          className="mt-auto w-full px-4 py-2.5 text-sm font-semibold rounded-lg border border-zinc-300 text-zinc-600 hover:bg-zinc-50 transition-colors disabled:opacity-60"
        >
          {isPending ? "..." : leaveLabel}
        </button>
      ) : isEnded ? null : (
        <>
          <button
            type="button"
            onClick={handleJoinClick}
            disabled={isPending || paymentLoading}
            className="mt-auto w-full px-4 py-2.5 text-sm font-semibold rounded-lg bg-[#e21d12] text-white border border-[#e21d12] hover:bg-[#d41810] transition-colors disabled:opacity-60"
          >
            {isPending || paymentLoading ? "..." : price > 0 ? `${t("payToJoin")} ${formatPrice(amountDueCents)}` : joinLabel}
          </button>
          {price > 0 && walletCredit > 0 && (
            <p className="text-xs text-zinc-500 text-center">
              {t("walletCreditApplied", { amount: formatPrice(walletCredit) })}
            </p>
          )}
        </>
      )}
      {joinError && (
        <p className="text-xs font-semibold text-red-600 text-center">{joinError}</p>
      )}

      {showPayConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-5">
            <div>
              <h2 className="text-lg font-extrabold text-zinc-900">{t("payConfirmTitle")}</h2>
              <p className="mt-1.5 text-sm text-zinc-500">
                {t("payConfirmBalance", { amount: formatPrice(availableWalletCents) })}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => startPayment(true)}
                disabled={paymentLoading}
                className="w-full py-2.5 text-sm font-semibold text-white bg-[#e21d12] rounded-lg hover:bg-[#d41810] transition-colors disabled:opacity-60"
              >
                {amountDueCents === 0
                  ? t("payWithWalletFull", { amount: formatPrice(walletCredit) })
                  : t("payWithWalletPartial", { credit: formatPrice(walletCredit), remainder: formatPrice(amountDueCents) })}
              </button>
              <button
                type="button"
                onClick={() => startPayment(false)}
                disabled={paymentLoading}
                className="w-full py-2.5 text-sm font-semibold text-zinc-700 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors disabled:opacity-60"
              >
                {t("payWithCardOnly", { amount: formatPrice(price) })}
              </button>
              <button
                type="button"
                onClick={() => setShowPayConfirm(false)}
                disabled={paymentLoading}
                className="text-sm font-semibold text-zinc-500 hover:text-zinc-700 transition-colors disabled:opacity-60"
              >
                {t("registrationCancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-zinc-100">
              <div>
                <h2 className="text-lg font-extrabold text-zinc-900">{t("registrationTitle")}</h2>
                <p className="text-xs text-zinc-500 mt-0.5">{t("registrationSubtitle")}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleFormSubmit} className="flex flex-col flex-1 min-h-0">
            <div className="overflow-y-auto flex-1 px-6 py-5 flex flex-col gap-4">
              {formFields.map(field => (
                <div key={field.id} className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-zinc-700">
                    {field.label}
                    {field.required && <span className="text-[#e21d12] ml-1">*</span>}
                  </label>

                  {field.fieldType === "text" && (
                    <input
                      type="text"
                      value={responses[field.id] ?? ""}
                      onChange={e => setResponse(field.id, e.target.value)}
                      className={inputClass}
                    />
                  )}

                  {field.fieldType === "number" && (
                    <input
                      type="number"
                      value={responses[field.id] ?? ""}
                      onChange={e => setResponse(field.id, e.target.value)}
                      className={inputClass}
                    />
                  )}

                  {field.fieldType === "dropdown" && (
                    <select
                      value={responses[field.id] ?? ""}
                      onChange={e => setResponse(field.id, e.target.value)}
                      className={inputClass}
                    >
                      <option value="">{t("registrationSelectPlaceholder")}</option>
                      {field.options.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  )}

                  {field.fieldType === "checkbox" && (
                    <div className="flex flex-col gap-2 pl-1">
                      {field.options.map(opt => {
                        const selected = (responses[field.id] ?? "").split("|||").includes(opt);
                        return (
                          <label key={opt} className="flex items-center gap-2.5 cursor-pointer">
                            <div
                              onClick={() => toggleCheckboxOption(field.id, opt, !selected)}
                              className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer ${
                                selected ? "bg-[#e21d12] border-[#e21d12]" : "border-zinc-300 bg-white"
                              }`}
                            >
                              {selected && (
                                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="2 6 5 9 10 3"/>
                                </svg>
                              )}
                            </div>
                            <span className="text-sm text-zinc-700">{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {field.fieldType === "file" && (
                    <div className="flex flex-col gap-1.5">
                      <label className={`flex items-center gap-3 px-4 py-3 border border-dashed border-zinc-200 rounded-lg bg-zinc-50 cursor-pointer hover:border-zinc-400 transition-colors ${fileUploading[field.id] ? "opacity-60 pointer-events-none" : ""}`}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400 flex-shrink-0">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                        <span className="text-sm text-zinc-600">
                          {fileUploading[field.id]
                            ? t("registrationUploading")
                            : responses[field.id]
                            ? t("registrationFileUploaded")
                            : t("registrationUploadFile")}
                        </span>
                        <input
                          type="file"
                          className="hidden"
                          onChange={e => { const f = e.target.files?.[0]; if (f) handleFileChange(field.id, f); }}
                        />
                      </label>
                      {responses[field.id] && (
                        <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          {t("registrationFileReady")}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {formError && (
                <p className="text-sm text-red-500 font-medium">{formError}</p>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-6 pb-6 pt-4 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-5 py-2.5 text-sm font-semibold text-zinc-700 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
              >
                {t("registrationCancel")}
              </button>
              <button
                type="submit"
                disabled={isPending || anyFileUploading}
                className="flex-1 py-2.5 text-sm font-semibold text-white rounded-lg bg-[#e21d12] hover:bg-[#d41810] disabled:opacity-60 transition-colors shadow-sm"
              >
                {isPending ? "..." : joinLabel}
              </button>
            </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
