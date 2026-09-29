"use client";

// "About" tab — "My Journey": a chronological list of orgs/teams the athlete
// has been part of, each with one or more nested roles (title + date range +
// "Current" badge). Unlike the batched extended-profile fields, experience
// and its roles live in their own normalized tables, so every add/edit/
// delete here persists immediately (its own server action call) rather than
// behind a section-wide Save/Cancel — there's no "draft" state to batch.
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import type { AthleteExperience, AthleteExperienceRole } from "@/app/actions/athlete";
import {
  addExperience,
  updateExperience,
  deleteExperience,
  addExperienceRole,
  updateExperienceRole,
  deleteExperienceRole,
} from "@/app/actions/athlete";

function formatMonthYear(iso: string | null) {
  if (!iso) return null;
  return new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(new Date(`${iso}T00:00:00`));
}

export default function AthleteExperienceSection({
  isOwnProfile,
  experience,
}: {
  isOwnProfile: boolean;
  experience: AthleteExperience[];
}) {
  const t = useTranslations("AthleteProfile");
  const router = useRouter();
  const [addingOrg, setAddingOrg] = useState(false);
  const [pending, startTransition] = useTransition();

  // Org + role are collected in one form on the initial add so a role is
  // never skipped — additional roles at the same org still go through
  // ExperienceEntry's own "+Add Role" (RoleForm), unchanged.
  function handleAddOrg(orgName: string, location: string, role: RoleFormValue) {
    startTransition(async () => {
      const { id } = await addExperience({ orgName, location: location || null });
      await addExperienceRole(id, role);
      setAddingOrg(false);
      router.refresh();
    });
  }

  return (
    <section className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-zinc-900">{t("journeyTitle")}</h2>
        {isOwnProfile && !addingOrg && (
          <button
            type="button"
            onClick={() => setAddingOrg(true)}
            className="text-sm font-semibold text-[#e21d12] hover:underline"
          >
            {t("addExperience")}
          </button>
        )}
      </div>

      {addingOrg && (
        <div className="mb-4">
          <NewExperienceForm
            onCancel={() => setAddingOrg(false)}
            onSubmit={handleAddOrg}
            saving={pending}
            saveLabel={t("save")}
            cancelLabel={t("cancel")}
          />
        </div>
      )}

      {experience.length === 0 && !addingOrg ? (
        <p className="text-sm text-zinc-400">{isOwnProfile ? t("noExperienceOwn") : t("noExperience")}</p>
      ) : (
        <div className="flex flex-col gap-5">
          {experience.map((exp) => (
            <ExperienceEntry key={exp.id} experience={exp} isOwnProfile={isOwnProfile} />
          ))}
        </div>
      )}
    </section>
  );
}

function ExperienceEntry({ experience, isOwnProfile }: { experience: AthleteExperience; isOwnProfile: boolean }) {
  const t = useTranslations("AthleteProfile");
  const router = useRouter();
  const [editingOrg, setEditingOrg] = useState(false);
  const [addingRole, setAddingRole] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleUpdateOrg(orgName: string, location: string) {
    startTransition(async () => {
      await updateExperience(experience.id, { orgName, location: location || null });
      setEditingOrg(false);
      router.refresh();
    });
  }

  function handleDeleteOrg() {
    startTransition(async () => {
      await deleteExperience(experience.id);
      router.refresh();
    });
  }

  function handleAddRole(role: RoleFormValue) {
    startTransition(async () => {
      await addExperienceRole(experience.id, role);
      setAddingRole(false);
      router.refresh();
    });
  }

  if (editingOrg) {
    return (
      <div className="border-l-2 border-zinc-100 pl-4">
        <OrgForm
          initialOrgName={experience.orgName}
          initialLocation={experience.location ?? ""}
          onCancel={() => setEditingOrg(false)}
          onSubmit={handleUpdateOrg}
          saving={pending}
          saveLabel={t("save")}
          cancelLabel={t("cancel")}
        />
      </div>
    );
  }

  return (
    <div className="border-l-2 border-zinc-100 pl-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-zinc-900 text-sm">{experience.orgName}</p>
          {experience.location && <p className="text-xs text-zinc-400">{experience.location}</p>}
        </div>
        {isOwnProfile && (
          <div className="flex items-center gap-1 shrink-0">
            <IconButton onClick={() => setEditingOrg(true)} label={t("edit")}>
              <PencilIcon />
            </IconButton>
            <IconButton onClick={handleDeleteOrg} label={t("delete")} disabled={pending}>
              <TrashIcon />
            </IconButton>
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-col gap-2">
        {experience.roles.map((role) => (
          <RoleRow key={role.id} role={role} isOwnProfile={isOwnProfile} />
        ))}
      </div>

      {addingRole ? (
        <div className="mt-2">
          <RoleForm
            onCancel={() => setAddingRole(false)}
            onSubmit={handleAddRole}
            saving={pending}
            saveLabel={t("save")}
            cancelLabel={t("cancel")}
          />
        </div>
      ) : (
        isOwnProfile && (
          <button type="button" onClick={() => setAddingRole(true)} className="mt-2 text-xs font-semibold text-[#e21d12] hover:underline">
            {t("addRole")}
          </button>
        )
      )}
    </div>
  );
}

function RoleRow({ role, isOwnProfile }: { role: AthleteExperienceRole; isOwnProfile: boolean }) {
  const t = useTranslations("AthleteProfile");
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleUpdate(value: RoleFormValue) {
    startTransition(async () => {
      await updateExperienceRole(role.id, value);
      setEditing(false);
      router.refresh();
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteExperienceRole(role.id);
      router.refresh();
    });
  }

  if (editing) {
    return (
      <RoleForm
        initial={role}
        onCancel={() => setEditing(false)}
        onSubmit={handleUpdate}
        saving={pending}
        saveLabel={t("save")}
        cancelLabel={t("cancel")}
      />
    );
  }

  const range = `${formatMonthYear(role.startDate) ?? t("dateUnset")} — ${role.isCurrent ? t("present") : formatMonthYear(role.endDate) ?? t("dateUnset")}`;

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-zinc-50 px-3 py-2">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-zinc-800 truncate">{role.title}</p>
        <div className="flex items-center gap-2">
          <p className="text-xs text-zinc-400">{range}</p>
          {role.isCurrent && (
            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-emerald-700">
              {t("currentBadge")}
            </span>
          )}
        </div>
      </div>
      {isOwnProfile && (
        <div className="flex items-center gap-1 shrink-0">
          <IconButton onClick={() => setEditing(true)} label={t("edit")}>
            <PencilIcon />
          </IconButton>
          <IconButton onClick={handleDelete} label={t("delete")} disabled={pending}>
            <TrashIcon />
          </IconButton>
        </div>
      )}
    </div>
  );
}

function OrgForm({
  initialOrgName = "",
  initialLocation = "",
  onCancel,
  onSubmit,
  saving,
  saveLabel,
  cancelLabel,
}: {
  initialOrgName?: string;
  initialLocation?: string;
  onCancel: () => void;
  onSubmit: (orgName: string, location: string) => void;
  saving: boolean;
  saveLabel: string;
  cancelLabel: string;
}) {
  const t = useTranslations("AthleteProfile");
  const [orgName, setOrgName] = useState(initialOrgName);
  const [location, setLocation] = useState(initialLocation);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 mb-4">
      <input
        type="text"
        value={orgName}
        onChange={(e) => setOrgName(e.target.value)}
        placeholder={t("orgNamePlaceholder")}
        className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-red-200 placeholder:text-zinc-400"
      />
      <input
        type="text"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        placeholder={t("locationPlaceholder")}
        className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-red-200 placeholder:text-zinc-400"
      />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} disabled={saving} className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-50">
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={() => orgName.trim() && onSubmit(orgName.trim(), location.trim())}
          disabled={saving || !orgName.trim()}
          className="px-3 py-1.5 text-xs font-semibold text-white rounded-lg bg-[#e21d12] hover:bg-[#d41810] disabled:opacity-60"
        >
          {saveLabel}
        </button>
      </div>
    </div>
  );
}

type RoleFormValue = { title: string; startDate: string | null; endDate: string | null; isCurrent: boolean };

const ROLE_OPTIONS = ["Player", "Starter", "Captain", "6th Man", "Coach", "Assistant Coach", "Head Coach", "Manager", "Referee"];

const ROLE_OPTION_KEYS: Record<string, string> = {
  "Player": "roleOptionPlayer",
  "Starter": "roleOptionStarter",
  "Captain": "roleOptionCaptain",
  "6th Man": "roleOptionSixthMan",
  "Coach": "roleOptionCoach",
  "Assistant Coach": "roleOptionAssistantCoach",
  "Head Coach": "roleOptionHeadCoach",
  "Manager": "roleOptionManager",
  "Referee": "roleOptionReferee",
};

function roleOptionKey(option: string) {
  return ROLE_OPTION_KEYS[option] ?? "roleOptionOther";
}

function RoleForm({
  initial,
  onCancel,
  onSubmit,
  saving,
  saveLabel,
  cancelLabel,
}: {
  initial?: AthleteExperienceRole;
  onCancel: () => void;
  onSubmit: (value: RoleFormValue) => void;
  saving: boolean;
  saveLabel: string;
  cancelLabel: string;
}) {
  const t = useTranslations("AthleteProfile");
  const initialIsPreset = !initial?.title || ROLE_OPTIONS.includes(initial.title);
  const [preset, setPreset] = useState(initialIsPreset ? initial?.title ?? "Player" : "Other");
  const [customTitle, setCustomTitle] = useState(initialIsPreset ? "" : initial?.title ?? "");
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [isCurrent, setIsCurrent] = useState(initial?.isCurrent ?? false);
  const title = preset === "Other" ? customTitle : preset;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-3">
      <label className="text-xs font-semibold text-zinc-600">{t("roleTitleLabel")}</label>
      <select
        value={preset}
        onChange={(e) => setPreset(e.target.value)}
        className="w-full px-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-red-200"
      >
        {ROLE_OPTIONS.map((option) => (
          <option key={option} value={option}>{t(roleOptionKey(option))}</option>
        ))}
        <option value="Other">{t("roleOptionOther")}</option>
      </select>
      {preset === "Other" && (
        <input
          type="text"
          value={customTitle}
          onChange={(e) => setCustomTitle(e.target.value)}
          placeholder={t("roleOtherPlaceholder")}
          className="w-full px-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-red-200 placeholder:text-zinc-400"
        />
      )}
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="flex-1 px-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-red-200"
        />
        <input
          type="date"
          value={endDate}
          disabled={isCurrent}
          onChange={(e) => setEndDate(e.target.value)}
          className="flex-1 px-3 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-red-200 disabled:opacity-50"
        />
      </div>
      <label className="flex items-center gap-2 text-xs font-semibold text-zinc-600">
        <input type="checkbox" checked={isCurrent} onChange={(e) => setIsCurrent(e.target.checked)} />
        {t("currentRoleLabel")}
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} disabled={saving} className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-50">
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={() =>
            title.trim() &&
            onSubmit({ title: title.trim(), startDate: startDate || null, endDate: isCurrent ? null : endDate || null, isCurrent })
          }
          disabled={saving || !title.trim()}
          className="px-3 py-1.5 text-xs font-semibold text-white rounded-lg bg-[#e21d12] hover:bg-[#d41810] disabled:opacity-60"
        >
          {saveLabel}
        </button>
      </div>
    </div>
  );
}

// Combined org + role form for the very first add (see the note on
// AthleteExperienceSection's handleAddOrg) — everything else (editing the
// org, adding/editing a second role at the same org) still uses OrgForm/
// RoleForm separately since a role is never in question there.
function NewExperienceForm({
  onCancel,
  onSubmit,
  saving,
  saveLabel,
  cancelLabel,
}: {
  onCancel: () => void;
  onSubmit: (orgName: string, location: string, role: RoleFormValue) => void;
  saving: boolean;
  saveLabel: string;
  cancelLabel: string;
}) {
  const t = useTranslations("AthleteProfile");
  const [orgName, setOrgName] = useState("");
  const [location, setLocation] = useState("");
  const [preset, setPreset] = useState("Player");
  const [customTitle, setCustomTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isCurrent, setIsCurrent] = useState(false);
  const title = preset === "Other" ? customTitle : preset;
  const canSave = orgName.trim() && title.trim();

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <input
        type="text"
        value={orgName}
        onChange={(e) => setOrgName(e.target.value)}
        placeholder={t("orgNamePlaceholder")}
        className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-red-200 placeholder:text-zinc-400"
      />
      <input
        type="text"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        placeholder={t("locationPlaceholder")}
        className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-red-200 placeholder:text-zinc-400"
      />

      <label className="text-xs font-semibold text-zinc-600">{t("roleTitleLabel")}</label>
      <select
        value={preset}
        onChange={(e) => setPreset(e.target.value)}
        className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-red-200"
      >
        {ROLE_OPTIONS.map((option) => (
          <option key={option} value={option}>{t(roleOptionKey(option))}</option>
        ))}
        <option value="Other">{t("roleOptionOther")}</option>
      </select>
      {preset === "Other" && (
        <input
          type="text"
          value={customTitle}
          onChange={(e) => setCustomTitle(e.target.value)}
          placeholder={t("roleOtherPlaceholder")}
          className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-red-200 placeholder:text-zinc-400"
        />
      )}

      <div className="flex items-center gap-2">
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="flex-1 px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-red-200"
        />
        <input
          type="date"
          value={endDate}
          disabled={isCurrent}
          onChange={(e) => setEndDate(e.target.value)}
          className="flex-1 px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-red-200 disabled:opacity-50"
        />
      </div>
      <label className="flex items-center gap-2 text-xs font-semibold text-zinc-600">
        <input type="checkbox" checked={isCurrent} onChange={(e) => setIsCurrent(e.target.checked)} />
        {t("currentRoleLabel")}
      </label>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} disabled={saving} className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-50">
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={() =>
            canSave &&
            onSubmit(orgName.trim(), location.trim(), {
              title: title.trim(),
              startDate: startDate || null,
              endDate: isCurrent ? null : endDate || null,
              isCurrent,
            })
          }
          disabled={saving || !canSave}
          className="px-3 py-1.5 text-xs font-semibold text-white rounded-lg bg-[#e21d12] hover:bg-[#d41810] disabled:opacity-60"
        >
          {saveLabel}
        </button>
      </div>
    </div>
  );
}

function IconButton({
  onClick,
  label,
  disabled,
  children,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
      className="flex size-6 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition-colors disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function PencilIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
