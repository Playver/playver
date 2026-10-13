// Locale layout: validates the :locale segment (404s on anything not in
// routing.locales), loads that locale's messages/*.json, and wraps every
// page in NextIntlClientProvider so client components can call
// useTranslations(). No nav/footer here — those are per-page or per-nested-
// layout (dashboard/, organizer/), since the marketing pages, dashboard, and
// organizer console each have different chrome. The one exception is the
// site-wide search window (GlobalSearch), which every chrome opens.
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { getMessages } from "next-intl/server";
import { routing } from "@/i18n/routing";
import GlobalSearch from "@/components/search/GlobalSearch";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
      <GlobalSearch />
    </NextIntlClientProvider>
  );
}
