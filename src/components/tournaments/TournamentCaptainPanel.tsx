"use client";

// Three tournament_team panels rendered in the event-detail Teams tab:
// TournamentCaptainPanel (full roster/recruitment/join-request management,
// captain only), TournamentMemberPanel (read-only view for regular
// members), and JoinOpenTeamButton (join a team whose recruitmentStatus is
// open, for non-members browsing). All three call into tournament.ts.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useTranslations } from "next-intl";
import {
  toggleTeamRecruitment,
  respondToJoinRequest,
  cancelJoinRequest,
  removeTeamMember,
  leaveTournamentTeam,
  disbandTournamentTeam,
  requestToJoinTeam,
  renameTournamentTeam,
} from "@/app/actions/tournament";
import type { TournamentTeam, TournamentJoinRequest } from "@/app/actions/tournament";
import { formatPrice } from "@/lib/format-price";

function Avatar({ name, image, size = 8 }: { name: string; image?: string | null; size?: number }) {
  const cls = `w-${size} h-${size} rounded-full object-cover`;
  return image
    ? <Image src={image} alt={name} width={32} height={32} className={cls} />
    : (
      <div className={`w-${size} h-${size} flex items-center justify-center rounded-full bg-zinc-100 text-xs font-extrabold uppercase text-zinc-500`}>
        {name[0]}
      </div>
    );
}

// ─── Captain panel ────────────────────────────────────────────────────────────

export function TournamentCaptainPanel({
  team,
  pendingRequests,
  tournamentId,
  price = 0,
}: {
  team: TournamentTeam;
  pendingRequests: TournamentJoinRequest[];
  tournamentId: string;
  price?: number;
}) {
  const t = useTranslations("TournamentPanel");
  const [isPending, startTransition] = useTransition();
  const [copiedLink, setCopiedLink] = useState(false);
  const [error, setError] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(team.name);

  function handleStartRename() {
    setNameInput(team.name);
    setEditingName(true);
  }

  function handleRename() {
    if (!nameInput.trim() || nameInput.trim() === team.name) { setEditingName(false); return; }
    startTransition(async () => {
      const res = await renameTournamentTeam(team.id, nameInput.trim());
      if (res.error) { setError(res.error); } else { setEditingName(false); router.refresh(); }
    });
  }

  async function handlePay() {
    // Confirm before redirecting to Checkout — a native confirm() is the
    // same "are you sure" gate already used for disband/leave in this file,
    // so this isn't spent silently on click.
    if (!confirm(t("payConfirm", { amount: formatPrice(price) }))) return;
    setPaymentLoading(true);
    setError("");
    try {
      const res = await fetch("/api/stripe/team-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: team.id }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? t("paymentError"));
        setPaymentLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError(t("paymentError"));
      setPaymentLoading(false);
    }
  }
  const router = useRouter();

  const inviteUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/tournaments/${tournamentId}/team/${team.id}/join?code=${team.inviteCode}`;

  function copyInviteLink() {
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  }

  function handleToggleRecruitment() {
    startTransition(async () => {
      const res = await toggleTeamRecruitment(team.id);
      if (res.error) { setError(res.error); return; }
      router.refresh();
    });
  }

  function handleRespond(requestId: string, accept: boolean) {
    startTransition(async () => {
      const res = await respondToJoinRequest(requestId, accept);
      if (res.error) { setError(res.error); return; }
      router.refresh();
    });
  }

  function handleRemoveMember(memberId: string) {
    startTransition(async () => {
      const res = await removeTeamMember(team.id, memberId);
      if (res.error) { setError(res.error); return; }
      router.refresh();
    });
  }

  function handleDisband() {
    if (!confirm(t("disbandConfirm"))) return;
    startTransition(async () => {
      const res = await disbandTournamentTeam(team.id);
      if (res.error) { setError(res.error); return; }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Status row */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold ${
          team.status === "active"
            ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
            : "bg-amber-50 border border-amber-200 text-amber-700"
        }`}>
          <span className={`w-2 h-2 rounded-full shrink-0 ${team.status === "active" ? "bg-emerald-500" : "bg-amber-500"}`} />
          {team.status === "active" ? t("teamRegistered") : t("awaitingPayment")}
          {team.status === "pending" && team.paymentDeadline && (
            <span className="ml-1 font-normal opacity-75 text-xs">
              · {t("deadline")}: {new Date(team.paymentDeadline).toLocaleDateString()}
            </span>
          )}
        </div>
        {team.status === "pending" && price > 0 && (
          <button
            type="button"
            onClick={handlePay}
            disabled={paymentLoading}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-[#e21d12] hover:bg-[#d41810] rounded-lg transition-colors disabled:opacity-60"
          >
            {paymentLoading ? "..." : t("completePayment")}
          </button>
        )}
        <div className="ml-auto">
          <button
            type="button"
            onClick={handleDisband}
            disabled={isPending}
            className="px-3 py-1.5 text-xs font-semibold text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg border border-red-100 transition-colors disabled:opacity-50"
          >
            {t("disbandTeam")}
          </button>
        </div>
      </div>

      {/* Stacked sections — this panel only ever renders inside a narrow sidebar */}
      <div className="flex flex-col gap-4">

        {/* Col 1: Team roster */}
        <div className="rounded-xl border border-zinc-200 p-4 flex flex-col gap-2">
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">{t("yourTeam")}</p>
          {editingName ? (
            <div className="flex items-center gap-1.5">
              <input
                autoFocus
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setEditingName(false); }}
                maxLength={60}
                className="flex-1 min-w-0 text-sm font-extrabold text-zinc-900 border-b border-zinc-300 outline-none bg-transparent"
              />
              <button type="button" onClick={handleRename} disabled={isPending} className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 disabled:opacity-50">Save</button>
              <button type="button" onClick={() => setEditingName(false)} className="text-[10px] font-bold text-zinc-400 hover:text-zinc-600">✕</button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 group">
              <p className="text-base font-extrabold text-zinc-900 leading-tight">{team.name}</p>
              <button type="button" onClick={handleStartRename} className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-zinc-600">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
            </div>
          )}
          <p className="text-xs text-zinc-500">{t("players", { current: team.memberCount, total: team.playerCount })}</p>
          <div className="mt-1 flex flex-col gap-2">
            {/* Captain */}
            <div className="flex items-center gap-2">
              <Avatar name={team.captainName} size={6} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-zinc-800 truncate">{team.captainName}</p>
                <p className="text-[10px] text-zinc-400">{t("captainLabel")}</p>
              </div>
            </div>
            {/* Members */}
            {team.members.map((m) => (
              <div key={m.id} className="flex items-center gap-2">
                <Avatar name={m.name} image={m.image} size={6} />
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold truncate ${m.confirmationStatus === "declined" ? "text-zinc-400 line-through" : "text-zinc-800"}`}>
                    {m.name}
                  </p>
                  {m.confirmationStatus === "pending" && (
                    <p className="text-[10px] font-semibold text-amber-600">{t("memberPending")}</p>
                  )}
                  {m.confirmationStatus === "declined" && (
                    <p className="text-[10px] font-semibold text-red-500">{t("memberDeclined")}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveMember(m.userId)}
                  disabled={isPending}
                  className="text-[10px] font-semibold text-red-400 hover:text-red-600 disabled:opacity-50 shrink-0"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Col 2: Invite link */}
        <div className="rounded-xl border border-zinc-200 p-4 flex flex-col gap-2">
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">{t("inviteLink")}</p>
          <p className="text-xs text-zinc-500 leading-relaxed">{t("inviteLinkDesc")}</p>
          <button
            type="button"
            onClick={copyInviteLink}
            className="mt-auto w-full px-3 py-2 text-xs font-semibold rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-50 transition-colors flex items-center justify-center gap-1.5"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            {copiedLink ? t("copied") : t("copyInviteLink")}
          </button>
        </div>

        {/* Col 3: Open recruitment */}
        <div className="rounded-xl border border-zinc-200 p-4 flex flex-col gap-2">
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">{t("openRecruitment")}</p>
          <p className="text-xs text-zinc-500 leading-relaxed">
            {team.recruitmentStatus === "open"
              ? t("recruitmentOpen")
              : t("recruitmentClosed")}
          </p>
          <div className="mt-auto flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-700">
              {team.recruitmentStatus === "open" ? t("recruitmentOn") : t("recruitmentOff")}
            </span>
            <button
              type="button"
              onClick={handleToggleRecruitment}
              disabled={isPending}
              className={`relative w-10 h-5 rounded-full transition-colors disabled:opacity-50 ${team.recruitmentStatus === "open" ? "bg-[#e21d12]" : "bg-zinc-200"}`}
              aria-pressed={team.recruitmentStatus === "open"}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${team.recruitmentStatus === "open" ? "left-[calc(100%-18px)]" : "left-0.5"}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Pending join requests */}
      {pendingRequests.length > 0 && (
        <div className="rounded-xl border border-zinc-200 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-zinc-400 mb-3">
            {t("joinRequests", { count: pendingRequests.length })}
          </p>
          <div className="flex flex-wrap gap-3">
            {pendingRequests.map((req) => (
              <div key={req.id} className="flex items-center gap-2 bg-white rounded-lg border border-zinc-100 px-3 py-2">
                <Avatar name={req.userName} image={req.userImage} size={6} />
                <p className="text-xs font-semibold text-zinc-800">{req.userName}</p>
                <div className="flex gap-1.5 ml-2">
                  <button
                    type="button"
                    onClick={() => handleRespond(req.id, true)}
                    disabled={isPending}
                    className="px-2 py-1 text-[10px] font-bold rounded-md bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50"
                  >
                    {t("accept")}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRespond(req.id, false)}
                    disabled={isPending}
                    className="px-2 py-1 text-[10px] font-bold rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
                  >
                    {t("decline")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
    </div>
  );
}

// ─── Member panel ─────────────────────────────────────────────────────────────

export function TournamentMemberPanel({ team }: { team: TournamentTeam }) {
  const t = useTranslations("TournamentPanel");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();

  function handleLeave() {
    if (!confirm(t("leaveConfirm"))) return;
    startTransition(async () => {
      const res = await leaveTournamentTeam(team.id);
      if (res.error) { setError(res.error); return; }
      router.refresh();
      try { window.dispatchEvent(new CustomEvent("teamMembershipChanged", { detail: { teamId: team.id, member: false } })); } catch (e) {}
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Status + leave row */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-sm font-semibold text-emerald-700">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          {t("youreOn")} <span className="font-extrabold ml-1">{team.name}</span>
        </div>
        <div className="ml-auto">
          <button
            type="button"
            onClick={handleLeave}
            disabled={isPending}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-zinc-300 text-zinc-600 hover:bg-zinc-50 transition-colors disabled:opacity-60"
          >
            {isPending ? "..." : t("leaveTeam")}
          </button>
        </div>
      </div>

      {/* Roster - horizontal chips */}
      <div className="rounded-xl border border-zinc-200 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-zinc-400 mb-3">{t("roster")}</p>
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2 bg-white rounded-lg border border-zinc-100 px-3 py-2">
            <div className="w-6 h-6 flex items-center justify-center rounded-full bg-zinc-100 text-[10px] font-extrabold uppercase text-zinc-500">
              {team.captainName[0]}
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-800">{team.captainName}</p>
              <p className="text-[10px] text-zinc-400">{t("captainLabel")}</p>
            </div>
          </div>
          {team.members.map((m) => (
            <div key={m.id} className="flex items-center gap-2 bg-white rounded-lg border border-zinc-100 px-3 py-2">
              {m.image
                ? <Image src={m.image} alt={m.name} width={24} height={24} className="w-6 h-6 rounded-full object-cover" />
                : <div className="w-6 h-6 flex items-center justify-center rounded-full bg-zinc-100 text-[10px] font-extrabold uppercase text-zinc-500">{m.name[0]}</div>}
              <p className="text-xs font-semibold text-zinc-800">{m.name}</p>
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
    </div>
  );
}

// ─── Open-recruitment join button ─────────────────────────────────────────────

export function JoinOpenTeamButton({ teamId, tournamentId }: { teamId: string; tournamentId: string }) {
  const t = useTranslations("TournamentPanel");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [requested, setRequested] = useState(false);
  const router = useRouter();

  function handleRequest(e: React.MouseEvent) {
    // This button can render inside a team-card <Link> (to the linked team page) —
    // stop the click from also triggering that navigation.
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      setError("");
      const res = await requestToJoinTeam(teamId);
      if (res.error) { setError(res.error); return; }
      setRequested(true);
      try {
        window.dispatchEvent(new CustomEvent("teamRequestSent", { detail: { teamId } }));
      } catch (e) {}
      router.refresh();
    });
  }

  function handleCancel(e: React.MouseEvent, requestId: string) {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      const res = await cancelJoinRequest(requestId);
      if (res.error) { setError(res.error); return; }
      setRequested(false);
      try { window.dispatchEvent(new CustomEvent("teamRequestCancelled", { detail: { teamId } })); } catch (e) {}
      router.refresh();
    });
  }

  if (requested) {
    return (
      <div className="text-center">
        <p className="text-xs text-zinc-500 mb-1">{t("requestSent")}</p>
        <button
          type="button"
          onClick={(e) => handleCancel(e, "")}
          disabled={isPending}
          className="text-xs font-semibold text-red-500 hover:text-red-700 disabled:opacity-50"
        >
          {t("cancelRequest")}
        </button>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleRequest}
        disabled={isPending}
        className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-50 transition-colors disabled:opacity-60"
      >
        {isPending ? "..." : t("requestToJoin")}
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
