"use client";

import CreateEventForm from "@/components/events/CreateEventForm";
import type { EventItem, FormField, EventCategory, EventPricingTier } from "@/app/actions/event";

// Thin wrapper around CreateEventForm for the organizer console's edit page.
// No onSuccess override here — CreateEventForm's own default (redirect to
// the public event page after saving) is what we want; /organizer/events/
// [eventId] is edit-form-only, so redirecting back to it after a save just
// looked like the save did nothing.
export default function OrganizerEventEditForm({
  event,
  formFields,
  categories,
  pricingTiers,
}: {
  event: EventItem;
  formFields: FormField[];
  categories: EventCategory[];
  pricingTiers: EventPricingTier[];
}) {
  return (
    <CreateEventForm
      initialData={event}
      initialFormFields={formFields}
      initialCategories={categories}
      initialPricingTiers={pricingTiers}
      eventId={event.id}
    />
  );
}
