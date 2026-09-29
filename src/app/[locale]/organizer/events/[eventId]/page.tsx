// Organizer-console event management page for one event: edit form +
// cancel/postpone. Only reachable for org-owned events with MANAGE_EVENTS —
// legacy events are managed from the public /events/[eventId]/edit instead.
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { ForbiddenError } from "@/lib/organizer-errors";
import { getOrganizerEventDetail } from "@/app/actions/organizer-events";
import OrganizerEventEditForm from "@/components/organizer/OrganizerEventEditForm";
import EventCancelPostponeButton from "@/components/events/EventCancelPostponeButton";

export default async function OrganizerEventManagePage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const [t, tCreate] = await Promise.all([
    getTranslations("Organizer"),
    getTranslations("CreateEvent"),
  ]);

  let detail;
  try {
    detail = await getOrganizerEventDetail(eventId);
  } catch (error) {
    // No active org, or caller lacks MANAGE_EVENTS in it — same "does not
    // exist for you" outcome as a bad eventId, not a distinct error page.
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }

  if ("error" in detail) notFound();
  const { event, formFields, categories } = detail;
  const isPaid = event.price > 0;

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <p className="text-sm font-bold tracking-wide uppercase text-[#e21d12] mb-1">{t("navEvents")}</p>
      <h1 className="text-3xl font-extrabold text-zinc-900 mb-8" style={{ fontFamily: "var(--font-playfair)" }}>
        {event.title}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8 items-start">
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6">
          <h2 className="text-lg font-bold text-zinc-900 mb-6">{tCreate("editTitle")}</h2>
          <OrganizerEventEditForm event={event} formFields={formFields} categories={categories} />
        </div>

        <aside className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 flex flex-col gap-4">
          {event.status === "cancelled" && (
            <span className="inline-flex self-start rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-[#e21d12]">
              {t("eventManageCancelledBadge")}
            </span>
          )}

          <EventCancelPostponeButton
            eventId={event.id}
            eventTitle={event.title}
            startDateTime={event.startDateTime}
            endDateTime={event.endDateTime}
            isPaid={isPaid}
          />

          <div className="border-t border-zinc-100 pt-4 flex flex-col gap-2">
            <Link href={`/events/${event.id}`} className="text-sm font-semibold text-zinc-600 hover:text-[#e21d12] transition-colors">
              {t("eventManageViewPublicPage")}
            </Link>
            <Link href="/organizer/registrations" className="text-sm font-semibold text-zinc-600 hover:text-[#e21d12] transition-colors">
              {t("eventManageViewRegistrations")}
            </Link>
            <Link href="/organizer/payments" className="text-sm font-semibold text-zinc-600 hover:text-[#e21d12] transition-colors">
              {t("eventManageViewPayments")}
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
