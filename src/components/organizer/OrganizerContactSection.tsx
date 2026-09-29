"use client";

// Contact panel (publicEmail/phone/website/social links/locations) — same
// fields the old wizard's Step5Contact collected. Locations persist via
// setOrganizationLocations (replace-all semantics, same as the wizard used),
// batched alongside the plain-field update in one save.
import { useTranslations } from "next-intl";
import OrganizerEditableSection from "@/components/organizer/OrganizerEditableSection";
import { updateOrganizationDraft, setOrganizationLocations, type LocationInput } from "@/app/actions/organization";
import { EMPTY_LOCATION } from "@/components/organizer/create-wizard/types";

type ContactValue = {
  publicEmail: string;
  phone: string;
  website: string;
  instagram: string;
  twitter: string;
  facebook: string;
  youtube: string;
  tiktok: string;
  locations: LocationInput[];
};

const inputClass =
  "w-full px-4 py-2.5 text-sm bg-zinc-50 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300 placeholder:text-zinc-400 text-zinc-800";
const labelClass = "text-sm font-semibold text-zinc-700";

export default function OrganizerContactSection({
  publicEmail,
  phone,
  website,
  socialLinks,
  locations,
}: {
  publicEmail: string;
  phone: string;
  website: string;
  socialLinks: Record<string, string>;
  locations: LocationInput[];
}) {
  const t = useTranslations("Organizer");

  const initialValue: ContactValue = {
    publicEmail,
    phone,
    website,
    instagram: socialLinks.instagram ?? "",
    twitter: socialLinks.twitter ?? "",
    facebook: socialLinks.facebook ?? "",
    youtube: socialLinks.youtube ?? "",
    tiktok: socialLinks.tiktok ?? "",
    locations,
  };

  async function handleSave(v: ContactValue) {
    const social: Record<string, string> = {};
    if (v.instagram.trim()) social.instagram = v.instagram.trim();
    if (v.twitter.trim()) social.twitter = v.twitter.trim();
    if (v.facebook.trim()) social.facebook = v.facebook.trim();
    if (v.youtube.trim()) social.youtube = v.youtube.trim();
    if (v.tiktok.trim()) social.tiktok = v.tiktok.trim();

    const [updateRes, locationsRes] = await Promise.all([
      updateOrganizationDraft({ publicEmail: v.publicEmail, phone: v.phone, website: v.website, socialLinks: social }),
      setOrganizationLocations(v.locations),
    ]);
    return { error: updateRes.error ?? locationsRes.error };
  }

  return (
    <OrganizerEditableSection<ContactValue>
      title={t("profileContactTitle")}
      initialValue={initialValue}
      onSave={handleSave}
      renderView={(v) => (
        <div className="flex flex-col gap-2 text-sm">
          {v.publicEmail && <p className="text-zinc-600">{v.publicEmail}</p>}
          {v.phone && <p className="text-zinc-600">{v.phone}</p>}
          {v.website && <p className="text-zinc-600">{v.website}</p>}
          {v.locations.length > 0 && (
            <div className="flex flex-col gap-1 mt-2">
              {v.locations.map((loc, i) => (
                <p key={i} className="text-zinc-500">{[loc.name, loc.city, loc.province].filter(Boolean).join(" · ")}</p>
              ))}
            </div>
          )}
          {!v.publicEmail && !v.phone && !v.website && v.locations.length === 0 && (
            <p className="text-zinc-400">{t("profileContactEmpty")}</p>
          )}
        </div>
      )}
      renderEdit={(v, setV) => {
        function updateLocation(index: number, patch: Partial<LocationInput>) {
          setV({ ...v, locations: v.locations.map((loc, i) => (i === index ? { ...loc, ...patch } : loc)) });
        }
        function addLocation() {
          setV({ ...v, locations: [...v.locations, { ...EMPTY_LOCATION }] });
        }
        function removeLocation(index: number) {
          setV({ ...v, locations: v.locations.filter((_, i) => i !== index) });
        }
        return (
          <>
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>{t("wizardPublicEmailLabel")}</label>
              <input
                type="email"
                value={v.publicEmail}
                onChange={(e) => setV({ ...v, publicEmail: e.target.value })}
                placeholder={t("wizardPublicEmailPlaceholder")}
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>{t("wizardPhoneLabel")}</label>
                <input type="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} placeholder={t("wizardPhonePlaceholder")} className={inputClass} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>{t("wizardWebsiteLabel")}</label>
                <input type="url" value={v.website} onChange={(e) => setV({ ...v, website: e.target.value })} placeholder={t("wizardWebsitePlaceholder")} className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>{t("wizardInstagramLabel")}</label>
                <input type="text" value={v.instagram} onChange={(e) => setV({ ...v, instagram: e.target.value })} placeholder="@handle" className={inputClass} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>{t("wizardTwitterLabel")}</label>
                <input type="text" value={v.twitter} onChange={(e) => setV({ ...v, twitter: e.target.value })} placeholder="@handle" className={inputClass} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>{t("wizardFacebookLabel")}</label>
                <input type="text" value={v.facebook} onChange={(e) => setV({ ...v, facebook: e.target.value })} placeholder="@handle" className={inputClass} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>{t("wizardYoutubeLabel")}</label>
                <input type="text" value={v.youtube} onChange={(e) => setV({ ...v, youtube: e.target.value })} placeholder="@handle" className={inputClass} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>{t("wizardTiktokLabel")}</label>
                <input type="text" value={v.tiktok} onChange={(e) => setV({ ...v, tiktok: e.target.value })} placeholder="@handle" className={inputClass} />
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <label className={labelClass}>{t("wizardLocationsLabel")}</label>
                <button type="button" onClick={addLocation} className="text-sm font-semibold text-[#e21d12] hover:text-red-700">
                  + {t("wizardAddLocation")}
                </button>
              </div>
              {v.locations.length === 0 && <p className="text-xs text-zinc-400">{t("wizardNoLocations")}</p>}
              {v.locations.map((loc, index) => (
                <div key={index} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-500">{t("wizardLocationN", { n: index + 1 })}</span>
                    <button type="button" onClick={() => removeLocation(index)} className="text-xs font-semibold text-red-500 hover:text-red-600">
                      {t("wizardRemoveLocation")}
                    </button>
                  </div>
                  <input
                    type="text"
                    value={loc.name}
                    onChange={(e) => updateLocation(index, { name: e.target.value })}
                    placeholder={t("wizardLocationNameLabel")}
                    className={`${inputClass} bg-white`}
                  />
                  <input
                    type="text"
                    value={loc.streetAddress}
                    onChange={(e) => updateLocation(index, { streetAddress: e.target.value })}
                    placeholder={t("wizardStreetAddressLabel")}
                    className={`${inputClass} bg-white`}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={loc.city}
                      onChange={(e) => updateLocation(index, { city: e.target.value })}
                      placeholder={t("wizardCityLabel")}
                      className={`${inputClass} bg-white`}
                    />
                    <input
                      type="text"
                      value={loc.postalCode}
                      onChange={(e) => updateLocation(index, { postalCode: e.target.value })}
                      placeholder={t("wizardPostalCodeLabel")}
                      className={`${inputClass} bg-white`}
                    />
                    <input
                      type="text"
                      value={loc.province}
                      onChange={(e) => updateLocation(index, { province: e.target.value })}
                      placeholder={t("wizardProvinceLabel")}
                      className={`${inputClass} bg-white`}
                    />
                    <input
                      type="text"
                      value={loc.country}
                      onChange={(e) => updateLocation(index, { country: e.target.value })}
                      placeholder={t("wizardCountryLabel")}
                      className={`${inputClass} bg-white`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        );
      }}
    />
  );
}
