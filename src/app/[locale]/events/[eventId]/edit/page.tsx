// Public edit page for a legacy (non-org) event — reuses CreateEventForm in
// edit mode via `eventId`. Org-owned events are edited from
// /organizer/events/[eventId] instead (OrganizerEventEditForm), which stays
// inside the organizer console chrome.
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import CreateEventForm from "@/components/events/CreateEventForm";
import { auth } from "@/lib/auth";
import { getEventById, getEventFormFields, getEventCategories, getEventPricingTiers } from "@/app/actions/event";
import { getUserRole } from "@/app/actions/admin";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  const [t, session] = await Promise.all([
    getTranslations("CreateEvent"),
    auth.api.getSession({ headers: await headers() }),
  ]);

  if (!session) notFound();

  const [event, userRole] = await Promise.all([
    getEventById(eventId),
    getUserRole(session.user.id),
  ]);
  if (!event) notFound();
  if (event.organizerId !== session.user.id && userRole !== "super_admin") notFound();

  const [formFields, categories, pricingTiers] = await Promise.all([
    event.customFormEnabled ? getEventFormFields(eventId) : Promise.resolve([]),
    getEventCategories(eventId),
    getEventPricingTiers(eventId),
  ]);

  return (
    <>
      <Navbar />
      <main className="flex-1 bg-zinc-50">
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-12">
          <h1
            className="text-3xl font-bold text-zinc-900 mb-8"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            {t("editTitle")}
          </h1>
          <CreateEventForm
            initialData={event}
            initialFormFields={formFields}
            initialCategories={categories}
            initialPricingTiers={pricingTiers}
            eventId={eventId}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
