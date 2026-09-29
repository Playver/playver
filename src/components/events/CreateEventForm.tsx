"use client";

// The single form used to both create and edit an event/tournament/league —
// passing `eventId` (+ `initialData`) switches it into edit mode
// (updateEvent instead of createEvent); this is also what
// OrganizerEventEditForm.tsx wraps for the organizer console. Covers: basic
// details, individual vs. team registration, pricing, image gallery,
// agenda, and a dynamic custom-registration-fields builder (FormFieldDraft)
// whose responses are collected later by EventJoinButton/joinEventWithForm.
import { useState, useRef, useTransition } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useRouter } from "@/i18n/routing";
import { createEvent, updateEvent } from "@/app/actions/event";
import { useUploadThing } from "@/lib/uploadthing";
import type { FormFieldType, EventItem, FormField, GalleryItem, AgendaItem, EventCategory, EventPricingTier, RecurrenceRule } from "@/app/actions/event";

function splitDateTime(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

const TIME_SLOTS = Array.from({ length: 96 }, (_, i) => {
  const hour24 = Math.floor(i / 4);
  const minute = (i % 4) * 15;
  const period = hour24 < 12 ? "AM" : "PM";
  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
  const label = `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
  const value = `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  return { label, value };
});

function TimeSelect({
  value,
  onChange,
  minValue,
  maxValue,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  minValue?: string;
  maxValue?: string;
  className?: string;
}) {
  const slots = TIME_SLOTS.filter(
    (s) => (!minValue || s.value > minValue) && (!maxValue || s.value <= maxValue)
  );
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={className}
      >
        <option value="">-- : --</option>
        {slots.map((slot) => (
          <option key={slot.value} value={slot.value}>{slot.label}</option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </span>
    </div>
  );
}

const SPORTS = ["Soccer","Basketball","Volleyball","Pickleball","Tennis","Hockey","Baseball","Cricket","Rugby","Other"];
const EVENT_TYPES = ["League","Tournament","Pickup Game","Training / Practice","Activity","Tryouts","Camps","Community","Galas"];
const FIELD_TYPES: { value: FormFieldType; labelKey: string }[] = [
  { value: "text",     labelKey: "customFormTypeText" },
  { value: "number",   labelKey: "customFormTypeNumber" },
  { value: "dropdown", labelKey: "customFormTypeDropdown" },
  { value: "checkbox", labelKey: "customFormTypeCheckbox" },
  { value: "file",     labelKey: "customFormTypeFile" },
];

type FormFieldDraft = {
  id: string;
  label: string;
  fieldType: FormFieldType;
  required: boolean;
  options: string[];
};

type AgendaItemDraft = {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  description: string;
};

// startTime/endTime are age-tiered session slots for individual events
// (e.g. karate's two time slots) — only shown/meaningful when
// registrationMode === "individual"; team events use capacity/
// maxPlayersPerTeam instead.
type CategoryDraft = {
  id: string;
  name: string;
  description: string;
  capacity: string;
  maxPlayersPerTeam: string;
  price: string;
  startTime: string;
  endTime: string;
};

// Resident/non-resident-style price variants, orthogonal to category.
type TierDraft = {
  id: string;
  label: string;
  price: string;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 flex flex-col gap-5">
      <h2 className="text-sm font-bold text-zinc-500 uppercase tracking-wide">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold text-zinc-700">
        {label} {required && <span className="text-[#e21d12]">*</span>}
      </label>
      {children}
    </div>
  );
}

function FormFieldBuilder({
  field,
  index,
  t,
  inputClass,
  onChange,
  onRemove,
}: {
  field: FormFieldDraft;
  index: number;
  t: ReturnType<typeof useTranslations>;
  inputClass: string;
  onChange: (updates: Partial<FormFieldDraft>) => void;
  onRemove: () => void;
}) {
  const needsOptions = field.fieldType === "dropdown" || field.fieldType === "checkbox";

  function addOption() {
    onChange({ options: [...field.options, ""] });
  }

  function updateOption(i: number, value: string) {
    const updated = field.options.map((o, idx) => (idx === i ? value : o));
    onChange({ options: updated });
  }

  function removeOption(i: number) {
    onChange({ options: field.options.filter((_, idx) => idx !== i) });
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
          {t("customFormQuestion")} {index + 1}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs font-semibold text-zinc-400 hover:text-red-500 transition-colors"
        >
          {t("customFormRemove")}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-zinc-600">{t("customFormTypeLabel")}</label>
          <select
            value={field.fieldType}
            onChange={e => onChange({ fieldType: e.target.value as FormFieldType, options: [] })}
            className={inputClass}
          >
            {FIELD_TYPES.map(ft => (
              <option key={ft.value} value={ft.value}>{t(ft.labelKey)}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-zinc-600">{t("customFormLabelLabel")}</label>
          <input
            type="text"
            value={field.label}
            onChange={e => onChange({ label: e.target.value })}
            placeholder={t("customFormLabelPlaceholder")}
            className={inputClass}
          />
        </div>
      </div>

      {needsOptions && (
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-zinc-600">{t("customFormOptionsLabel")}</label>
          {field.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={opt}
                onChange={e => updateOption(i, e.target.value)}
                placeholder={`${t("customFormOptionPlaceholder")} ${i + 1}`}
                className={`${inputClass} flex-1`}
              />
              <button
                type="button"
                onClick={() => removeOption(i)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addOption}
            className="self-start text-xs font-semibold text-[#e21d12] hover:text-[#c32722] transition-colors"
          >
            {t("customFormAddOption")}
          </button>
        </div>
      )}

      <div className="flex items-center gap-1 pt-1">
        <span className="text-xs text-zinc-500 mr-2">{t("customFormRequiredToggle")}:</span>
        <button
          type="button"
          onClick={() => onChange({ required: false })}
          className={`px-3 py-1 text-xs font-semibold rounded-full border transition-colors ${
            !field.required
              ? "bg-zinc-800 text-white border-zinc-800"
              : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400"
          }`}
        >
          {t("customFormOptional")}
        </button>
        <button
          type="button"
          onClick={() => onChange({ required: true })}
          className={`px-3 py-1 text-xs font-semibold rounded-full border transition-colors ${
            field.required
              ? "bg-[#e21d12] text-white border-[#e21d12]"
              : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400"
          }`}
        >
          {t("customFormRequired")}
        </button>
      </div>
    </div>
  );
}

function AgendaItemBuilder({
  item,
  index,
  t,
  inputClass,
  onChange,
  onRemove,
  eventStartDate,
  eventStartTime,
  eventEndDate,
  eventEndTime,
}: {
  item: AgendaItemDraft;
  index: number;
  t: ReturnType<typeof useTranslations>;
  inputClass: string;
  onChange: (updates: Partial<AgendaItemDraft>) => void;
  onRemove: () => void;
  eventStartDate: string;
  eventStartTime: string;
  eventEndDate: string;
  eventEndTime: string;
}) {
  const isOnStartDay = item.date !== "" && item.date === eventStartDate;
  const isOnEndDay   = item.date !== "" && item.date === eventEndDate;

  // TimeSelect minValue is exclusive (slot.value > minValue), so pass the slot
  // just before the event start to enforce "agenda start >= event start"
  const prevSlot = (hhmm: string) => {
    const idx = TIME_SLOTS.findIndex(s => s.value === hhmm);
    return idx > 0 ? TIME_SLOTS[idx - 1].value : undefined;
  };

  const startTimeMin = isOnStartDay && eventStartTime ? prevSlot(eventStartTime) : undefined;
  const startTimeMax = isOnEndDay   && eventEndTime   ? eventEndTime : undefined;
  const endTimeMax   = isOnEndDay   && eventEndTime   ? eventEndTime : undefined;

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
          {t("agendaItem")} {index + 1}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs font-semibold text-zinc-400 hover:text-red-500 transition-colors"
        >
          {t("agendaItemRemove")}
        </button>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-zinc-600">{t("agendaItemTitle")}</label>
        <input
          type="text"
          value={item.title}
          onChange={e => onChange({ title: e.target.value })}
          placeholder={t("agendaItemTitlePlaceholder")}
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-zinc-600">{t("agendaItemDate")}</label>
        <input
          type="date"
          value={item.date}
          min={eventStartDate || undefined}
          max={eventEndDate || undefined}
          onChange={e => onChange({ date: e.target.value, startTime: "", endTime: "" })}
          className={inputClass}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-zinc-600">{t("agendaItemStart")}</label>
          <TimeSelect
            value={item.startTime}
            onChange={v => onChange({ startTime: v, endTime: "" })}
            minValue={startTimeMin}
            maxValue={startTimeMax}
            className={`${inputClass} appearance-none`}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-zinc-600">{t("agendaItemEnd")}</label>
          <TimeSelect
            value={item.endTime}
            onChange={v => onChange({ endTime: v })}
            minValue={item.startTime || undefined}
            maxValue={endTimeMax}
            className={`${inputClass} appearance-none`}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-zinc-600">{t("agendaItemDescription")}</label>
        <input
          type="text"
          value={item.description}
          onChange={e => onChange({ description: e.target.value })}
          placeholder={t("agendaItemDescriptionPlaceholder")}
          className={inputClass}
        />
      </div>
    </div>
  );
}

function CategoryBuilder({
  category,
  index,
  t,
  inputClass,
  isTeamEvent,
  isPaid,
  onChange,
  onRemove,
}: {
  category: CategoryDraft;
  index: number;
  t: ReturnType<typeof useTranslations>;
  inputClass: string;
  isTeamEvent: boolean;
  isPaid: boolean;
  onChange: (updates: Partial<CategoryDraft>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
          {t("category")} {index + 1}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs font-semibold text-zinc-400 hover:text-red-500 transition-colors"
        >
          {t("categoryRemove")}
        </button>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-zinc-600">{t("categoryName")}</label>
        <input
          type="text"
          value={category.name}
          onChange={e => onChange({ name: e.target.value })}
          placeholder={t("categoryNamePlaceholder")}
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-zinc-600">{t("categoryDescription")}</label>
        <input
          type="text"
          value={category.description}
          onChange={e => onChange({ description: e.target.value })}
          placeholder={t("categoryDescriptionPlaceholder")}
          className={inputClass}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-zinc-600">
            {isTeamEvent ? t("categoryCapacityTeam") : t("categoryCapacity")}
          </label>
          <input
            type="number" min="1"
            value={category.capacity}
            onChange={e => onChange({ capacity: e.target.value })}
            placeholder={t("categoryCapacityPlaceholder")}
            className={inputClass}
          />
        </div>
        {isTeamEvent && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-zinc-600">{t("categoryMaxPlayers")}</label>
            <input
              type="number" min="1"
              value={category.maxPlayersPerTeam}
              onChange={e => onChange({ maxPlayersPerTeam: e.target.value })}
              placeholder={t("categoryMaxPlayersPlaceholder")}
              className={inputClass}
            />
          </div>
        )}
      </div>
      {!isTeamEvent && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-zinc-600">{t("categoryStartTime")}</label>
            <TimeSelect
              value={category.startTime}
              onChange={v => onChange({ startTime: v, endTime: "" })}
              className={`${inputClass} appearance-none`}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-zinc-600">{t("categoryEndTime")}</label>
            <TimeSelect
              value={category.endTime}
              onChange={v => onChange({ endTime: v })}
              minValue={category.startTime || undefined}
              className={`${inputClass} appearance-none`}
            />
          </div>
        </div>
      )}
      {isPaid && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-zinc-600">{t("categoryPrice")}</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-semibold text-sm">$</span>
            <input
              type="number" min="0.50" step="0.01"
              value={category.price}
              onChange={e => onChange({ price: e.target.value })}
              placeholder={t("categoryPricePlaceholder")}
              className={`${inputClass} pl-8`}
            />
          </div>
          <p className="text-xs text-zinc-400 mt-1">{t("categoryPriceHint")}</p>
        </div>
      )}
    </div>
  );
}

function TierBuilder({
  tier,
  index,
  t,
  inputClass,
  onChange,
  onRemove,
}: {
  tier: TierDraft;
  index: number;
  t: ReturnType<typeof useTranslations>;
  inputClass: string;
  onChange: (updates: Partial<TierDraft>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
          {t("tier")} {index + 1}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs font-semibold text-zinc-400 hover:text-red-500 transition-colors"
        >
          {t("tierRemove")}
        </button>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-zinc-600">{t("tierLabel")}</label>
        <input
          type="text"
          value={tier.label}
          onChange={e => onChange({ label: e.target.value })}
          placeholder={t("tierLabelPlaceholder")}
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-zinc-600">{t("tierPrice")}</label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-semibold text-sm">$</span>
          <input
            type="number" min="0.50" step="0.01"
            value={tier.price}
            onChange={e => onChange({ price: e.target.value })}
            placeholder={t("tierPricePlaceholder")}
            className={`${inputClass} pl-8`}
          />
        </div>
      </div>
    </div>
  );
}

export default function CreateEventForm({
  onSuccess,
  onCancel,
  initialData,
  initialFormFields,
  initialCategories,
  initialPricingTiers,
  eventId,
}: {
  onSuccess?: () => void;
  onCancel?: () => void;
  initialData?: EventItem;
  initialFormFields?: FormField[];
  initialCategories?: EventCategory[];
  initialPricingTiers?: EventPricingTier[];
  eventId?: string;
}) {
  const t = useTranslations("CreateEvent");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEditMode = Boolean(eventId);

  const initStart = initialData ? splitDateTime(initialData.startDateTime) : null;
  const initEnd   = initialData ? splitDateTime(initialData.endDateTime)   : null;

  const [title, setTitle]             = useState(initialData?.title ?? "");
  // A sport value that isn't one of the dropdown's own options (e.g. an
  // event edited before "Other" existed, or a custom sport from a prior
  // save) reopens as "Other" with that value pre-filled in the custom input.
  const initialSportIsCustom = Boolean(initialData?.sport) && !SPORTS.includes(initialData!.sport);
  const [sport, setSport]             = useState(initialSportIsCustom ? "Other" : (initialData?.sport ?? ""));
  const [customSport, setCustomSport] = useState(initialSportIsCustom ? initialData!.sport : "");
  const [eventType, setEventType]     = useState(initialData?.eventType ?? "");
  const [location, setLocation]       = useState(initialData?.location ?? "");
  const [startDate, setStartDate]     = useState(initStart?.date ?? "");
  const [startTime, setStartTime]     = useState(initStart?.time ?? "");
  const [endDate, setEndDate]         = useState(initEnd?.date ?? "");
  const [endTime, setEndTime]         = useState(initEnd?.time ?? "");
  const [registrationMode, setRegistrationMode] = useState<"individual" | "team">(
    (initialData?.registrationMode as "individual" | "team") ?? "individual"
  );
  const [capacity, setCapacity]           = useState(initialData?.capacity ? String(initialData.capacity) : "");
  const [maxPlayersPerTeam, setMaxPlayersPerTeam] = useState(
    initialData?.maxPlayersPerTeam ? String(initialData.maxPlayersPerTeam) : ""
  );
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [rules, setRules]             = useState(initialData?.rules ?? "");
  const [error, setError]             = useState("");

  // Pricing
  const [isPaid, setIsPaid]           = useState((initialData?.price ?? 0) > 0);
  const [priceAmount, setPriceAmount] = useState(
    initialData?.price && initialData.price > 0 ? String(initialData.price / 100) : ""
  );

  // Agenda
  const [agendaItems, setAgendaItems] = useState<AgendaItemDraft[]>(
    initialData?.agendaItems?.map(a => ({
      id: crypto.randomUUID(),
      title: a.title,
      date: a.date ?? "",
      startTime: a.startTime,
      endTime: a.endTime,
      description: a.description ?? "",
    })) ?? []
  );

  // Categories (divisions for team events; age-tiered slots for individual events)
  const [categories, setCategories] = useState<CategoryDraft[]>(
    initialCategories?.map(c => ({
      id: crypto.randomUUID(),
      name: c.name,
      description: c.description ?? "",
      capacity: c.capacity != null ? String(c.capacity) : "",
      maxPlayersPerTeam: c.maxPlayersPerTeam != null ? String(c.maxPlayersPerTeam) : "",
      price: c.price != null ? String(c.price / 100) : "",
      startTime: c.startTime ?? "",
      endTime: c.endTime ?? "",
    })) ?? []
  );

  // Pricing tiers (resident/non-resident-style variants, orthogonal to category)
  const [pricingTiers, setPricingTiers] = useState<TierDraft[]>(
    initialPricingTiers?.map(tier => ({
      id: crypto.randomUUID(),
      label: tier.label,
      price: String(tier.price / 100),
    })) ?? []
  );

  // Competition schedule (Schedule/Results/Standings tabs) — only offered
  // for team events for now (see event-flow-redesign plan's deferred
  // individual+schedule combination). New team events default to on,
  // matching every existing eventType="Tournament" event's real behavior;
  // editing an existing event always reflects its actual saved value.
  const [hasCompetitionSchedule, setHasCompetitionSchedule] = useState(
    initialData ? initialData.hasCompetitionSchedule : true
  );

  // Recurrence — "every Monday, Sept 21-Dec 7" — only offered for
  // individual events (a recurring class/program shape, e.g. karate/yoga),
  // display-only for now: rendered as text on the event page, not a
  // generator of individual session occurrences/attendance.
  const [recurrenceDays, setRecurrenceDays] = useState<string[]>(initialData?.recurrenceRule?.daysOfWeek ?? []);
  const [recurrenceStartDate, setRecurrenceStartDate] = useState(initialData?.recurrenceRule?.startDate ?? "");
  const [recurrenceEndDate, setRecurrenceEndDate] = useState(initialData?.recurrenceRule?.endDate ?? "");

  function toggleRecurrenceDay(day: string) {
    setRecurrenceDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  }

  // Custom form
  const [customFormEnabled, setCustomFormEnabled] = useState(initialData?.customFormEnabled ?? false);
  const [formFields, setFormFields] = useState<FormFieldDraft[]>(
    initialFormFields?.map(f => ({
      id: f.id,
      label: f.label,
      fieldType: f.fieldType,
      required: f.required,
      options: f.options,
    })) ?? []
  );

  // Cover image
  const [coverFile, setCoverFile]         = useState<File | null>(null);
  const [coverPreview, setCoverPreview]   = useState<string | null>(null);
  const [existingCoverUrl, setExistingCoverUrl] = useState<string | null>(initialData?.coverImageUrl ?? null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Gallery
  const [galleryFiles, setGalleryFiles]       = useState<File[]>([]);
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([]);
  const [existingGalleryItems, setExistingGalleryItems] = useState<GalleryItem[]>(
    initialData?.galleryItems ?? []
  );
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [uploadingCover, setUploadingCover]     = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);

  const { startUpload: uploadCover }   = useUploadThing("eventCover");
  const { startUpload: uploadGallery } = useUploadThing("eventGallery");

  function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  }

  function handleGalleryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const combined = [...galleryFiles, ...files].slice(0, 10 - existingGalleryItems.length);
    setGalleryFiles(combined);
    setGalleryPreviews(combined.map(f => URL.createObjectURL(f)));
  }

  function removeGalleryItem(index: number) {
    const updated = galleryFiles.filter((_, i) => i !== index);
    setGalleryFiles(updated);
    setGalleryPreviews(updated.map(f => URL.createObjectURL(f)));
  }

  function removeExistingGalleryItem(index: number) {
    setExistingGalleryItems(prev => prev.filter((_, i) => i !== index));
  }

  function addFormField() {
    setFormFields(prev => [
      ...prev,
      { id: crypto.randomUUID(), label: "", fieldType: "text", required: false, options: [] },
    ]);
  }

  function updateFormField(id: string, updates: Partial<FormFieldDraft>) {
    setFormFields(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  }

  function removeFormField(id: string) {
    setFormFields(prev => prev.filter(f => f.id !== id));
  }

  function addAgendaItem() {
    setAgendaItems(prev => [
      ...prev,
      { id: crypto.randomUUID(), title: "", date: "", startTime: "", endTime: "", description: "" },
    ]);
  }

  function updateAgendaItem(id: string, updates: Partial<AgendaItemDraft>) {
    setAgendaItems(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
  }

  function removeAgendaItem(id: string) {
    setAgendaItems(prev => prev.filter(a => a.id !== id));
  }

  function addCategory() {
    setCategories(prev => [
      ...prev,
      { id: crypto.randomUUID(), name: "", description: "", capacity: "", maxPlayersPerTeam: "", price: "", startTime: "", endTime: "" },
    ]);
  }

  function updateCategory(id: string, updates: Partial<CategoryDraft>) {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }

  function removeCategory(id: string) {
    setCategories(prev => prev.filter(c => c.id !== id));
  }

  function addTier() {
    setPricingTiers(prev => [...prev, { id: crypto.randomUUID(), label: "", price: "" }]);
  }

  function updateTier(id: string, updates: Partial<TierDraft>) {
    setPricingTiers(prev => prev.map(tr => tr.id === id ? { ...tr, ...updates } : tr));
  }

  function removeTier(id: string) {
    setPricingTiers(prev => prev.filter(tr => tr.id !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !sport || !eventType || !location || !startDate || !startTime || !endDate || !endTime) {
      setError(t("requiredFields"));
      return;
    }
    if (sport === "Other" && !customSport.trim()) {
      setError(t("customSportRequired"));
      return;
    }
    if (new Date(`${endDate}T${endTime}`) <= new Date(`${startDate}T${startTime}`)) {
      setError(t("endBeforeStart"));
      return;
    }
    if (isPaid && (!priceAmount || parseFloat(priceAmount) <= 0)) {
      setError(t("priceRequired"));
      return;
    }
    if (customFormEnabled) {
      const hasEmptyLabel = formFields.some(f => !f.label.trim());
      if (hasEmptyLabel) { setError(t("customFormNoLabel")); return; }
      for (const f of formFields) {
        if ((f.fieldType === "dropdown" || f.fieldType === "checkbox") && f.options.filter(o => o.trim()).length === 0) {
          setError(t("customFormNoOptions")); return;
        }
      }
    }
    setError("");

    // Upload cover if new file selected; otherwise keep existing URL
    let coverImageUrl: string | undefined;
    if (coverFile) {
      setUploadingCover(true);
      try {
        const res = await uploadCover([coverFile]);
        coverImageUrl = res?.[0]?.ufsUrl ?? res?.[0]?.url;
      } catch { setError(t("uploadError")); setUploadingCover(false); return; }
      setUploadingCover(false);
    } else if (existingCoverUrl) {
      coverImageUrl = existingCoverUrl;
    }

    // Upload new gallery files; keep existing items
    let newGalleryItems: GalleryItem[] = [];
    if (galleryFiles.length > 0) {
      setUploadingGallery(true);
      try {
        const res = await uploadGallery(galleryFiles);
        newGalleryItems = (res ?? []).map((r, i) => ({
          url: r.ufsUrl ?? r.url,
          type: (galleryFiles[i]?.type ?? "").startsWith("video") ? "video" : "image",
        }));
      } catch { setError(t("uploadError")); setUploadingGallery(false); return; }
      setUploadingGallery(false);
    }

    const allGalleryItems: GalleryItem[] = [...existingGalleryItems, ...newGalleryItems];

    const eventData = {
      title, sport: sport === "Other" ? customSport.trim() : sport, eventType, location,
      startDateTime: `${startDate}T${startTime}`,
      endDateTime: `${endDate}T${endTime}`,
      coverImageUrl,
      galleryItems: allGalleryItems,
      agendaItems: agendaItems.filter(a => a.title.trim()).map(a => ({
        title: a.title.trim(),
        date: a.date || undefined,
        startTime: a.startTime,
        endTime: a.endTime,
        description: a.description.trim() || undefined,
      } satisfies AgendaItem)),
      registrationMode,
      capacity: capacity ? parseInt(capacity) : undefined,
      maxPlayersPerTeam: registrationMode === "team" && maxPlayersPerTeam ? parseInt(maxPlayersPerTeam) : undefined,
      description: description || undefined,
      rules: rules || undefined,
      price: isPaid && priceAmount ? Math.round(parseFloat(priceAmount) * 100) : 0,
      customFormEnabled,
      formFields: customFormEnabled
        ? formFields.map((f, i) => ({
            label: f.label.trim(),
            fieldType: f.fieldType,
            required: f.required,
            options: f.options.filter(o => o.trim()),
            order: i,
          }))
        : undefined,
      categories: categories
        .filter(c => c.name.trim())
        .map((c, i) => ({
          name: c.name.trim(),
          description: c.description.trim() || undefined,
          capacity: c.capacity ? parseInt(c.capacity) : undefined,
          maxPlayersPerTeam: registrationMode === "team" && c.maxPlayersPerTeam ? parseInt(c.maxPlayersPerTeam) : undefined,
          price: isPaid && c.price ? Math.round(parseFloat(c.price) * 100) : undefined,
          startTime: registrationMode === "individual" && c.startTime ? c.startTime : undefined,
          endTime: registrationMode === "individual" && c.endTime ? c.endTime : undefined,
          sortOrder: i,
        })),
      pricingTiers: pricingTiers
        .filter(tr => tr.label.trim() && tr.price)
        .map((tr, i) => ({
          label: tr.label.trim(),
          price: Math.round(parseFloat(tr.price) * 100),
          sortOrder: i,
        })),
      hasCompetitionSchedule: registrationMode === "team" ? hasCompetitionSchedule : false,
      recurrenceRule:
        registrationMode === "individual" && recurrenceDays.length > 0 && recurrenceStartDate && recurrenceEndDate
          ? ({ daysOfWeek: recurrenceDays, startDate: recurrenceStartDate, endDate: recurrenceEndDate } satisfies RecurrenceRule)
          : null,
    };

    startTransition(async () => {
      try {
        if (isEditMode && eventId) {
          await updateEvent(eventId, eventData);
          if (onSuccess) {
            onSuccess();
          } else {
            router.push(`/events/${eventId}` as Parameters<typeof router.push>[0]);
            router.refresh();
          }
        } else {
          await createEvent(eventData);
          if (onSuccess) {
            onSuccess();
          } else {
            router.push({ pathname: "/events", query: { created: "event" } });
          }
        }
      } catch {
        setError(isEditMode ? t("editError") : t("createError"));
      }
    });
  }

  const busy = uploadingCover || uploadingGallery || isPending;
  const inputClass = "w-full px-4 py-3 text-sm bg-zinc-50 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-red-200 placeholder:text-zinc-400 text-zinc-800";
  const totalGalleryCount = existingGalleryItems.length + galleryFiles.length;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">

      {/* Basic Info */}
      <Section title={t("sectionBasic")}>
        <Field label={t("titleLabel")} required>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder={t("titlePlaceholder")} className={inputClass} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t("sportLabel")} required>
            <select value={sport} onChange={e => setSport(e.target.value)} className={inputClass}>
              <option value="">{t("selectSport")}</option>
              {SPORTS.map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label={t("eventTypeLabel")} required>
            <select value={eventType} onChange={e => setEventType(e.target.value)} className={inputClass}>
              <option value="">{t("selectType")}</option>
              {EVENT_TYPES.map(et => <option key={et}>{et}</option>)}
            </select>
          </Field>
        </div>
        {sport === "Other" && (
          <Field label={t("customSportLabel")} required>
            <input
              type="text" value={customSport} onChange={e => setCustomSport(e.target.value)}
              placeholder={t("customSportPlaceholder")} className={inputClass}
            />
          </Field>
        )}
        <Field label={t("locationLabel")} required>
          <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder={t("locationPlaceholder")} className={inputClass} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t("startDateLabel")} required>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputClass} />
          </Field>
          <Field label={t("startTimeLabel")} required>
            <TimeSelect value={startTime} onChange={setStartTime} className={`${inputClass} appearance-none`} />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t("endDateLabel")} required>
            <input type="date" value={endDate} min={startDate || undefined} onChange={e => setEndDate(e.target.value)} className={inputClass} />
          </Field>
          <Field label={t("endTimeLabel")} required>
            <TimeSelect
              value={endTime}
              onChange={setEndTime}
              minValue={endDate && startDate && endDate === startDate ? startTime : undefined}
              className={`${inputClass} appearance-none`}
            />
          </Field>
        </div>
      </Section>

      {/* Cover Image */}
      <Section title={t("sectionMedia")}>
        <Field label={t("coverLabel")}>
          <div
            onClick={() => coverInputRef.current?.click()}
            className={`relative cursor-pointer rounded-xl overflow-hidden border-2 border-dashed transition-colors ${
              (coverPreview ?? existingCoverUrl) ? "border-transparent" : "border-zinc-200 hover:border-zinc-400"
            }`}
          >
            {(coverPreview ?? existingCoverUrl) ? (
              <div className="relative h-48">
                <Image src={(coverPreview ?? existingCoverUrl)!} alt="Cover" fill className="object-cover" />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <span className="text-white text-sm font-semibold">{t("changeCover")}</span>
                </div>
              </div>
            ) : (
              <div className="h-48 flex flex-col items-center justify-center gap-2 bg-zinc-50">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-300">
                  <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                </svg>
                <p className="text-sm font-semibold text-zinc-700">{t("coverUploadLabel")}</p>
                <p className="text-xs text-zinc-400">{t("coverHint")}</p>
              </div>
            )}
          </div>
          {(coverPreview || existingCoverUrl) && (
            <button
              type="button"
              onClick={() => { setCoverFile(null); setCoverPreview(null); setExistingCoverUrl(null); }}
              className="self-start text-xs text-zinc-400 hover:text-zinc-600 underline mt-1"
            >
              {t("removeCover")}
            </button>
          )}
          <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
        </Field>

        {/* Gallery */}
        <Field label={t("galleryLabel")}>
          <div className="flex flex-col gap-3">
            {totalGalleryCount > 0 && (
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                {/* Existing gallery items */}
                {existingGalleryItems.map((item, i) => (
                  <div key={`ex-${i}`} className="relative aspect-square rounded-lg overflow-hidden group bg-zinc-900">
                    {item.type === "video" ? (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="white" className="opacity-60">
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                      </div>
                    ) : (
                      <img src={item.url} alt={`Gallery ${i}`} className="absolute inset-0 w-full h-full object-cover" />
                    )}
                    <button
                      type="button"
                      onClick={() => removeExistingGalleryItem(i)}
                      className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                ))}
                {/* New file previews */}
                {galleryPreviews.map((src, i) => (
                  <div key={`new-${i}`} className="relative aspect-square rounded-lg overflow-hidden group">
                    <Image src={src} alt={`Gallery ${i}`} fill className="object-cover" />
                    <button
                      type="button"
                      onClick={() => removeGalleryItem(i)}
                      className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                ))}
                {totalGalleryCount < 10 && (
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="aspect-square rounded-lg border-2 border-dashed border-zinc-200 hover:border-zinc-400 flex items-center justify-center transition-colors"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-zinc-400"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </button>
                )}
              </div>
            )}
            {totalGalleryCount === 0 && (
              <div
                onClick={() => galleryInputRef.current?.click()}
                className="cursor-pointer border-2 border-dashed border-zinc-200 hover:border-zinc-400 rounded-xl p-6 text-center transition-colors"
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-300 mx-auto mb-2">
                  <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                </svg>
                <p className="text-sm font-medium text-zinc-700">{t("galleryUploadLabel")}</p>
                <p className="text-xs text-zinc-400 mt-1">{t("galleryHint")}</p>
              </div>
            )}
            <input ref={galleryInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleGalleryChange} />
          </div>
        </Field>
      </Section>

      {/* Registration */}
      <Section title={t("sectionRegistration")}>
        <Field label={t("registrationModeLabel")}>
          <div className="flex gap-3">
            {(["individual","team"] as const).map(mode => (
              <button
                key={mode} type="button"
                onClick={() => setRegistrationMode(mode)}
                className={`flex-1 py-3 text-sm font-semibold rounded-lg border transition-colors ${
                  registrationMode === mode
                    ? "bg-[#e21d12] text-white border-[#e21d12]"
                    : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400"
                }`}
              >
                {mode === "individual" ? t("modeIndividual") : t("modeTeam")}
              </button>
            ))}
          </div>
        </Field>
        <Field label={registrationMode === "team" ? t("capacityTeamLabel") : t("capacityLabel")}>
          <input
            type="number" min="1" value={capacity} onChange={e => setCapacity(e.target.value)}
            placeholder={t("capacityPlaceholder")} className={inputClass}
          />
        </Field>
        {registrationMode === "team" && (
          <Field label={t("maxPlayersLabel")}>
            <input
              type="number" min="1" value={maxPlayersPerTeam} onChange={e => setMaxPlayersPerTeam(e.target.value)}
              placeholder={t("maxPlayersPlaceholder")} className={inputClass}
            />
          </Field>
        )}

        {registrationMode === "team" && (
          <button
            type="button"
            onClick={() => setHasCompetitionSchedule(v => !v)}
            className="w-full flex items-center justify-between py-3 px-4 rounded-xl border border-zinc-200 bg-zinc-50 hover:border-zinc-300 transition-colors"
          >
            <div className="text-left">
              <p className="text-sm font-semibold text-zinc-700">{t("hasCompetitionScheduleLabel")}</p>
              <p className="text-xs text-zinc-400">{t("hasCompetitionScheduleHint")}</p>
            </div>
            <div className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${hasCompetitionSchedule ? "bg-[#e21d12]" : "bg-zinc-200"}`}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${hasCompetitionSchedule ? "translate-x-6" : "translate-x-1"}`} />
            </div>
          </button>
        )}

        {registrationMode === "individual" && (
          <div className="flex flex-col gap-2 pt-1 border-t border-zinc-100">
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide pt-3">{t("sectionRecurrence")}</p>
            <p className="text-xs text-zinc-400 -mt-1">{t("sectionRecurrenceHint")}</p>
            <div className="flex flex-wrap gap-2">
              {(["monday","tuesday","wednesday","thursday","friday","saturday","sunday"] as const).map(day => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleRecurrenceDay(day)}
                  className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${
                    recurrenceDays.includes(day)
                      ? "bg-[#e21d12] text-white border-[#e21d12]"
                      : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400"
                  }`}
                >
                  {t(`recurrenceDay_${day}`)}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
              <Field label={t("recurrenceStartDate")}>
                <input
                  type="date" value={recurrenceStartDate} onChange={e => setRecurrenceStartDate(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label={t("recurrenceEndDate")}>
                <input
                  type="date" value={recurrenceEndDate} min={recurrenceStartDate || undefined} onChange={e => setRecurrenceEndDate(e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>
          </div>
        )}

        {/* Pricing */}
        <div className="pt-1 border-t border-zinc-100">
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-3">{t("sectionPricing")}</p>
          <div className="flex gap-3 mb-3">
            {([false, true] as const).map((paid) => (
              <button
                key={String(paid)}
                type="button"
                onClick={() => { setIsPaid(paid); if (!paid) setPriceAmount(""); }}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-lg border transition-colors ${
                  isPaid === paid
                    ? "bg-[#e21d12] text-white border-[#e21d12]"
                    : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400"
                }`}
              >
                {paid ? t("pricingPaid") : t("pricingFree")}
              </button>
            ))}
          </div>
          {isPaid && (
            <Field label={t("priceLabel")}>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-semibold text-sm">$</span>
                <input
                  type="number"
                  min="0.50"
                  step="0.01"
                  value={priceAmount}
                  onChange={e => setPriceAmount(e.target.value)}
                  placeholder={t("pricePlaceholder")}
                  className={`${inputClass} pl-8`}
                />
              </div>
              <p className="text-xs text-zinc-400 mt-1">{t("priceHint")}</p>
            </Field>
          )}
        </div>

        {/* Custom form toggle */}
        <div className="pt-1 border-t border-zinc-100">
          <button
            type="button"
            onClick={() => { setCustomFormEnabled(v => !v); if (customFormEnabled) setFormFields([]); }}
            className="w-full flex items-center justify-between py-3 px-4 rounded-xl border border-zinc-200 bg-zinc-50 hover:border-zinc-300 transition-colors"
          >
            <div className="flex items-center gap-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
              </svg>
              <div className="text-left">
                <p className="text-sm font-semibold text-zinc-700">{t("customFormToggle")}</p>
                <p className="text-xs text-zinc-400">{t("customFormToggleHint")}</p>
              </div>
            </div>
            <div className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${customFormEnabled ? "bg-[#e21d12]" : "bg-zinc-200"}`}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${customFormEnabled ? "translate-x-6" : "translate-x-1"}`} />
            </div>
          </button>
        </div>

        {/* Form builder */}
        {customFormEnabled && (
          <div className="flex flex-col gap-3 pt-1">
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wide">{t("customFormSection")}</p>
            {formFields.map((field, index) => (
              <FormFieldBuilder
                key={field.id}
                field={field}
                index={index}
                t={t}
                inputClass={inputClass}
                onChange={updates => updateFormField(field.id, updates)}
                onRemove={() => removeFormField(field.id)}
              />
            ))}
            <button
              type="button"
              onClick={addFormField}
              className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-zinc-200 hover:border-[#e21d12] hover:text-[#e21d12] text-zinc-400 text-sm font-semibold transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              {t("customFormAdd")}
            </button>
          </div>
        )}
      </Section>

      {/* Categories — divisions for team events (e.g. tournament pools) or
          age-tiered session slots for individual events (e.g. a karate
          class's two time slots). Optional: zero categories means this
          event behaves exactly as before. */}
      <Section title={t("sectionCategories")}>
        <p className="text-xs text-zinc-400 -mt-2">{t("sectionCategoriesHint")}</p>
        <div className="flex flex-col gap-3">
          {categories.map((category, index) => (
            <CategoryBuilder
              key={category.id}
              category={category}
              index={index}
              t={t}
              inputClass={inputClass}
              isTeamEvent={registrationMode === "team"}
              isPaid={isPaid}
              onChange={updates => updateCategory(category.id, updates)}
              onRemove={() => removeCategory(category.id)}
            />
          ))}
          <button
            type="button"
            onClick={addCategory}
            className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-zinc-200 hover:border-[#e21d12] hover:text-[#e21d12] text-zinc-400 text-sm font-semibold transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            {t("categoryAdd")}
          </button>
        </div>
      </Section>

      {/* Pricing tiers — resident/non-resident-style price variants a
          registrant picks regardless of category. Only relevant for paid
          events; a category's own price override (above) always wins over
          a tier if both are set on the same registration. */}
      {isPaid && (
        <Section title={t("sectionPricingTiers")}>
          <p className="text-xs text-zinc-400 -mt-2">{t("sectionPricingTiersHint")}</p>
          <div className="flex flex-col gap-3">
            {pricingTiers.map((tier, index) => (
              <TierBuilder
                key={tier.id}
                tier={tier}
                index={index}
                t={t}
                inputClass={inputClass}
                onChange={updates => updateTier(tier.id, updates)}
                onRemove={() => removeTier(tier.id)}
              />
            ))}
            <button
              type="button"
              onClick={addTier}
              className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-zinc-200 hover:border-[#e21d12] hover:text-[#e21d12] text-zinc-400 text-sm font-semibold transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              {t("tierAdd")}
            </button>
          </div>
        </Section>
      )}

      {/* Agenda */}
      <Section title={t("sectionAgenda")}>
        <div className="flex flex-col gap-3">
          {agendaItems.map((item, index) => (
            <AgendaItemBuilder
              key={item.id}
              item={item}
              index={index}
              t={t}
              inputClass={inputClass}
              onChange={updates => updateAgendaItem(item.id, updates)}
              onRemove={() => removeAgendaItem(item.id)}
              eventStartDate={startDate}
              eventStartTime={startTime}
              eventEndDate={endDate}
              eventEndTime={endTime}
            />
          ))}
          <button
            type="button"
            onClick={addAgendaItem}
            className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-zinc-200 hover:border-[#e21d12] hover:text-[#e21d12] text-zinc-400 text-sm font-semibold transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            {t("agendaAdd")}
          </button>
        </div>
      </Section>

      {/* Description & Rules */}
      <Section title={t("sectionDetails")}>
        <Field label={t("descriptionLabel")}>
          <textarea
            value={description} onChange={e => setDescription(e.target.value)} rows={4}
            placeholder={t("descriptionPlaceholder")}
            className={`${inputClass} resize-none`}
          />
        </Field>
        <Field label={t("rulesLabel")}>
          <textarea
            value={rules} onChange={e => setRules(e.target.value)} rows={3}
            placeholder={t("rulesPlaceholder")}
            className={`${inputClass} resize-none`}
          />
        </Field>
      </Section>

      {/* Upload status */}
      {(uploadingCover || uploadingGallery) && (
        <p className="text-sm text-zinc-500 font-medium text-center">
          {uploadingCover ? t("uploadingCover") : t("uploadingGallery")}
        </p>
      )}

      {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

      <div className="flex gap-3">
        <button
          type="button" onClick={onCancel ?? (() => router.back())}
          className="px-6 py-3 text-sm font-semibold text-zinc-700 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors"
        >
          {t("cancel")}
        </button>
        <button
          type="submit" disabled={busy}
          className="flex-1 py-3 text-sm font-semibold text-white rounded-lg bg-[#e21d12] hover:bg-[#d41810] disabled:opacity-60 transition-colors shadow-sm"
        >
          {busy
            ? (isEditMode ? t("saving") : t("creating"))
            : (isEditMode ? t("saveChanges") : t("submit"))
          }
        </button>
      </div>

    </form>
  );
}
