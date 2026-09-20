"use client";

// Team-registration entry point for a tournament: create a brand-new
// tournament_team ("new" mode) or bring in one of the player's existing
// standalone teams ("existing" mode, via importExistingTeamForTournament —
// see tournament-tables.ts's isImportedTeam/linkedTeamId columns). Paid
// tournaments settle via payForTeamWithWallet, mirroring EventJoinButton's
// wallet-credit-then-charge pattern.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { createTournamentTeam, importExistingTeamForTournament, payForTeamWithWallet } from "@/app/actions/tournament";
import type { MyTeamOption } from "@/app/actions/tournament";
import { formatPrice } from "@/lib/format-price";

type Mode = "new" | "existing";

export default function TournamentRegisterButton({
  tournamentId,
  price = 0,
  maxPlayersPerTeam,
  myTeams = [],
}: {
  tournamentId: string;
  price?: number;
  maxPlayersPerTeam?: number | null;
  myTeams?: MyTeamOption[];
}) {
  const t = useTranslations("TournamentRegister");
  const [showModal, setShowModal] = useState(false);
  const [mode, setMode] = useState<Mode>("new");
  const [teamName, setTeamName] = useState("");
  const [playerCount, setPlayerCount] = useState(maxPlayersPerTeam ?? 5);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [insufficientFunds, setInsufficientFunds] = useState(false);
  const router = useRouter();

  const max = maxPlayersPerTeam ?? 20;
  const hasExistingTeams = myTeams.length > 0;

  function openModal() {
    setMode("new");
    setTeamName("");
    setPlayerCount(maxPlayersPerTeam ?? 5);
    setSelectedTeamId("");
    setError("");
    setShowModal(true);
  }

  function handleTeamSelect(teamId: string) {
    setSelectedTeamId(teamId);
    const team = myTeams.find((t) => t.id === teamId);
    if (team) {
      setTeamName(team.name);
      setPlayerCount(max);
    }
  }

  async function payFromWallet(teamId: string) {
    // Team payment is wallet-only on this branch — confirm before spending,
    // same gate as TournamentCaptainPanel's handlePay. Cancelling here just
    // leaves the team created but unpaid ("pending") — the captain can pay
    // later from the team panel.
    if (!confirm(t("payConfirm", { amount: formatPrice(price) }))) {
      router.refresh(); // team was already created (pending payment) — show it
      return;
    }
    setPaymentLoading(true);
    setPaymentError("");
    setInsufficientFunds(false);
    const result = await payForTeamWithWallet(teamId);
    if (result.error) {
      setPaymentError(result.error);
      setInsufficientFunds(result.error === "Insufficient wallet balance");
    } else {
      router.refresh();
    }
    setPaymentLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!teamName.trim()) { setError(t("errorTeamName")); return; }
    if (playerCount < 1) { setError(t("errorPlayerCount")); return; }
    if (mode === "existing" && !selectedTeamId) { setError(t("errorSelectTeam")); return; }

    startTransition(async () => {
      setError("");
      const result = mode === "existing"
        ? await importExistingTeamForTournament(tournamentId, selectedTeamId, teamName.trim(), playerCount)
        : await createTournamentTeam(tournamentId, teamName.trim(), playerCount);

      if (result.error) { setError(result.error); return; }

      setShowModal(false);

      if (price > 0 && result.teamId) {
        await payFromWallet(result.teamId);
        return;
      }

      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        disabled={paymentLoading}
        className="w-full px-4 py-2.5 text-sm font-semibold rounded-lg bg-[#e21d12] text-white hover:bg-[#d41810] transition-colors disabled:opacity-60"
      >
        {paymentLoading ? t("redirecting") : t("registerButton")}
      </button>
      {paymentError && (
        <p className="mt-2 text-xs font-semibold text-red-600 text-center">
          {paymentError}
          {insufficientFunds && (
            <>
              {" — "}
              <Link href="/dashboard/wallet" className="underline">
                {t("addFundsLink")}
              </Link>
            </>
          )}
        </p>
      )}

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-zinc-100">
              <div>
                <h2 className="text-lg font-extrabold text-zinc-900">{t("modalTitle")}</h2>
                <p className="text-xs text-zinc-500 mt-0.5">{t("modalSubtitle")}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Mode tabs */}
            {hasExistingTeams && (
              <div className="px-6 pt-4 flex gap-2">
                {(["new", "existing"] as Mode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setMode(m);
                      setError("");
                      setSelectedTeamId("");
                      setTeamName("");
                      setPlayerCount(maxPlayersPerTeam ?? 5);
                    }}
                    className={`flex-1 py-2 text-sm font-semibold rounded-lg border transition-colors ${
                      mode === m
                        ? "bg-[#e21d12] text-white border-[#e21d12]"
                        : "text-zinc-600 border-zinc-200 hover:border-zinc-400"
                    }`}
                  >
                    {m === "new" ? t("tabNew") : t("tabImport")}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4 overflow-y-auto">

              {/* Existing team picker */}
              {mode === "existing" && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-zinc-700">
                    {t("selectTeamLabel")} <span className="text-[#e21d12]">*</span>
                  </label>
                  <div className="flex flex-col gap-2">
                    {myTeams.map((team) => (
                      <button
                        key={team.id}
                        type="button"
                        onClick={() => handleTeamSelect(team.id)}
                        className={`flex items-center justify-between px-4 py-3 rounded-lg border text-left transition-colors ${
                          selectedTeamId === team.id
                            ? "border-[#e21d12] bg-[#e21d12]/5"
                            : "border-zinc-200 hover:border-zinc-300"
                        }`}
                      >
                        <div>
                          <p className="text-sm font-bold text-zinc-900">{team.name}</p>
                          <p className="text-xs text-zinc-500">{team.sport} · {t("membersCount", { count: team.memberCount })}</p>
                        </div>
                        {selectedTeamId === team.id && (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e21d12" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                  {selectedTeamId && (
                    <p className="text-xs text-zinc-500 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2">
                      {t("importNotice")}
                    </p>
                  )}
                </div>
              )}

              {/* Team name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-zinc-700">
                  {t("teamNameLabel")} <span className="text-[#e21d12]">*</span>
                </label>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder={mode === "existing" && selectedTeamId ? "" : t("teamNamePlaceholder")}
                  maxLength={60}
                  className="w-full px-4 py-2.5 text-sm bg-white border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-red-200 placeholder:text-zinc-400 text-zinc-800"
                />
              </div>

              {/* Player count */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-zinc-700">
                  {t("playerCountLabel")}
                  {maxPlayersPerTeam && (
                    <span className="ml-1 font-normal text-zinc-400">{t("playerCountMax", { max: maxPlayersPerTeam })}</span>
                  )}
                </label>
                <input
                  type="number"
                  value={playerCount}
                  min={1}
                  max={max}
                  onChange={(e) => setPlayerCount(Math.max(1, Math.min(max, parseInt(e.target.value) || 1)))}
                  className="w-full px-4 py-2.5 text-sm bg-white border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-red-200 text-zinc-800"
                />
              </div>

              {price > 0 && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
                  <span className="font-bold">{t("paidWarningBold")}</span> {t("paidWarning")}
                </div>
              )}

              {error && <p className="text-sm font-semibold text-red-600">{error}</p>}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 text-sm font-semibold text-zinc-700 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 py-2.5 text-sm font-semibold text-white rounded-lg bg-[#e21d12] hover:bg-[#d41810] disabled:opacity-60 transition-colors"
                >
                  {isPending ? "..." : price > 0 ? t("registerAndPay") : t("registerTeam")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
