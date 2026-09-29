"use client";

// "About" tab — Education: institution/program/dates. Own normalized
// table, so add/edit/delete persist immediately, same as
// AthleteExperienceSection (no page-wide batch Save here either).
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import type { AthleteEducation } from "@/app/actions/athlete";
import { addEducation, updateEducation, deleteEducation } from "@/app/actions/athlete";

function formatMonthYear(iso: string | null) {
  if (!iso) return null;
  return new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(new Date(`${iso}T00:00:00`));
}

type EducationFormValue = {
  institution: string;
  degree: string | null;
  startDate: string | null;
  endDate: string | null;
};

export default function AthleteEducationSection({
  isOwnProfile,
  education,
}: {
  isOwnProfile: boolean;
  education: AthleteEducation[];
}) {
  const t = useTranslations("AthleteProfile");
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleAdd(value: EducationFormValue) {
    startTransition(async () => {
      await addEducation(value);
      setAdding(false);
      router.refresh();
    });
  }

  return (
    <section className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-zinc-900">{t("educationTitle")}</h2>
        {isOwnProfile && !adding && (
          <button type="button" onClick={() => setAdding(true)} className="text-sm font-semibold text-[#e21d12] hover:underline">
            {t("addEducation")}
          </button>
        )}
      </div>

      {adding && (
        <div className="mb-4">
          <EducationForm onCancel={() => setAdding(false)} onSubmit={handleAdd} saving={pending} saveLabel={t("save")} cancelLabel={t("cancel")} />
        </div>
      )}

      {education.length === 0 && !adding ? (
        <p className="text-sm text-zinc-400">{isOwnProfile ? t("noEducationOwn") : t("noEducation")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {education.map((edu) => (
            <EducationEntry key={edu.id} education={edu} isOwnProfile={isOwnProfile} />
          ))}
        </div>
      )}
    </section>
  );
}

function EducationEntry({ education, isOwnProfile }: { education: AthleteEducation; isOwnProfile: boolean }) {
  const t = useTranslations("AthleteProfile");
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleUpdate(value: EducationFormValue) {
    startTransition(async () => {
      await updateEducation(education.id, value);
      setEditing(false);
      router.refresh();
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteEducation(education.id);
      router.refresh();
    });
  }

  if (editing) {
    return (
      <EducationForm
        initial={education}
        onCancel={() => setEditing(false)}
        onSubmit={handleUpdate}
        saving={pending}
        saveLabel={t("save")}
        cancelLabel={t("cancel")}
      />
    );
  }

  const range = `${formatMonthYear(education.startDate) ?? t("dateUnset")} — ${formatMonthYear(education.endDate) ?? t("present")}`;

  return (
    <div className="flex items-start justify-between gap-2 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-bold text-zinc-900">{education.institution}</p>
        {education.degree && <p className="text-xs text-zinc-500">{education.degree}</p>}
        <p className="text-xs text-zinc-400 mt-0.5">{range}</p>
      </div>
      {isOwnProfile && (
        <div className="flex items-center gap-1 shrink-0">
          <button type="button" onClick={() => setEditing(true)} aria-label={t("edit")} className="flex size-6 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
            <PencilIcon />
          </button>
          <button type="button" onClick={handleDelete} disabled={pending} aria-label={t("delete")} className="flex size-6 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50">
            <TrashIcon />
          </button>
        </div>
      )}
    </div>
  );
}

function EducationForm({
  initial,
  onCancel,
  onSubmit,
  saving,
  saveLabel,
  cancelLabel,
}: {
  initial?: AthleteEducation;
  onCancel: () => void;
  onSubmit: (value: EducationFormValue) => void;
  saving: boolean;
  saveLabel: string;
  cancelLabel: string;
}) {
  const t = useTranslations("AthleteProfile");
  const [institution, setInstitution] = useState(initial?.institution ?? "");
  const [degree, setDegree] = useState(initial?.degree ?? "");
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <input
        type="text"
        value={institution}
        onChange={(e) => setInstitution(e.target.value)}
        placeholder={t("institutionPlaceholder")}
        className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-red-200 placeholder:text-zinc-400"
      />
      <input
        type="text"
        value={degree}
        onChange={(e) => setDegree(e.target.value)}
        placeholder={t("degreePlaceholder")}
        className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-red-200 placeholder:text-zinc-400"
      />
      <div className="flex gap-2">
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="flex-1 px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-red-200" />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="flex-1 px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-red-200" />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} disabled={saving} className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-50">
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={() =>
            institution.trim() &&
            onSubmit({
              institution: institution.trim(),
              degree: degree.trim() || null,
              startDate: startDate || null,
              endDate: endDate || null,
            })
          }
          disabled={saving || !institution.trim()}
          className="px-3 py-1.5 text-xs font-semibold text-white rounded-lg bg-[#e21d12] hover:bg-[#d41810] disabled:opacity-60"
        >
          {saveLabel}
        </button>
      </div>
    </div>
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
