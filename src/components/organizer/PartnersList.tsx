"use client";

// Sponsor/partner directory for /organizer/partners. Mirrors PeopleClient's
// shape: list + "+ Add" trigger + edit/remove per row + a create/edit modal +
// an inline remove-confirmation dialog, all via router.refresh() after a
// successful mutation rather than local state surgery.
import { useState, useTransition } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { deletePartner, type PartnerRow } from "@/app/actions/organizer-partners";
import PartnerFormModal from "@/components/organizer/PartnerFormModal";

export default function PartnersList({ partners }: { partners: PartnerRow[] }) {
  const t = useTranslations("Organizer");
  const router = useRouter();
  const [formTarget, setFormTarget] = useState<PartnerRow | "new" | null>(null);
  const [removeTarget, setRemoveTarget] = useState<PartnerRow | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleRemoveConfirm() {
    if (!removeTarget) return;
    const id = removeTarget.id;
    setRemoveTarget(null);
    setError("");
    startTransition(async () => {
      const result = await deletePartner(id);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-5">
        <p className="text-sm text-zinc-500">{t("partnersCountLabel", { count: partners.length })}</p>
        <button
          type="button"
          onClick={() => setFormTarget("new")}
          className="px-4 py-2.5 text-sm font-semibold text-white rounded-lg bg-[#e21d12] hover:bg-[#d41810] transition-colors shrink-0"
        >
          {t("addPartnerButton")}
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm font-semibold text-red-600">
          {error}
        </div>
      )}

      {partners.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 py-16 text-center">
          <p className="text-zinc-500 font-semibold">{t("partnersEmptyDescription")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {partners.map((partner) => {
            const initial = partner.name[0]?.toUpperCase() ?? "?";
            const isRowPending = isPending && removeTarget?.id === partner.id;
            return (
              <div key={partner.id} className="flex items-center gap-4 bg-white rounded-2xl border border-zinc-200 px-5 py-4 shadow-sm">
                <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-100 font-bold text-zinc-500">
                  {partner.logoUrl ? (
                    <Image src={partner.logoUrl} alt={partner.name} width={44} height={44} className="size-11 object-cover" />
                  ) : (
                    initial
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-extrabold text-zinc-900 text-sm truncate">{partner.name}</p>
                  {partner.description && (
                    <p className="text-xs text-zinc-500 truncate mt-0.5">{partner.description}</p>
                  )}
                  {partner.website && (
                    <a
                      href={partner.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-[#e21d12] hover:underline mt-0.5 inline-block truncate"
                    >
                      {partner.website}
                    </a>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setFormTarget(partner)}
                    disabled={isRowPending}
                    className="px-3 py-1.5 text-sm font-semibold text-zinc-700 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors disabled:opacity-50"
                  >
                    {t("partnerEditButton")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRemoveTarget(partner)}
                    disabled={isRowPending}
                    className="px-3 py-1.5 text-sm font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    {t("partnerRemoveButton")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {removeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.45)" }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-5">
            <div>
              <h2 className="text-lg font-extrabold text-zinc-900">{t("partnerRemoveTitle")}</h2>
              <p className="mt-1.5 text-sm text-zinc-500">{t("partnerRemoveConfirm", { name: removeTarget.name })}</p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setRemoveTarget(null)}
                className="flex-1 py-2.5 text-sm font-semibold text-zinc-700 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
              >
                {t("partnerRemoveCancelButton")}
              </button>
              <button
                type="button"
                onClick={handleRemoveConfirm}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-[#e21d12] rounded-lg hover:bg-[#d41810] transition-colors"
              >
                {t("partnerRemoveConfirmButton")}
              </button>
            </div>
          </div>
        </div>
      )}

      {formTarget && (
        <PartnerFormModal
          partner={formTarget === "new" ? null : formTarget}
          onClose={() => setFormTarget(null)}
          onSuccess={() => {
            setFormTarget(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
