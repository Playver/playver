import { createUploadthing, type FileRouter } from "uploadthing/next";

const f = createUploadthing();

export const ourFileRouter = {
  teamCover: f({ image: { maxFileSize: "16MB", maxFileCount: 1 } })
    .middleware(() => ({}))
    .onUploadComplete(({ file }) => ({ url: file.ufsUrl })),

  teamLogo: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .middleware(() => ({}))
    .onUploadComplete(({ file }) => ({ url: file.ufsUrl })),

  eventCover: f({ image: { maxFileSize: "16MB", maxFileCount: 1 } })
    .middleware(() => ({}))
    .onUploadComplete(({ file }) => ({ url: file.ufsUrl })),

  eventGallery: f({
    image: { maxFileSize: "16MB", maxFileCount: 10 },
    video: { maxFileSize: "64MB", maxFileCount: 10 },
  })
    .middleware(() => ({}))
    .onUploadComplete(({ file }) => ({ url: file.ufsUrl })),

  profileAvatar: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .middleware(() => ({}))
    .onUploadComplete(({ file }) => ({ url: file.ufsUrl })),

  profileCover: f({ image: { maxFileSize: "16MB", maxFileCount: 1 } })
    .middleware(() => ({}))
    .onUploadComplete(({ file }) => ({ url: file.ufsUrl })),

  profileMedia: f({
    image: { maxFileSize: "16MB", maxFileCount: 10 },
    video: { maxFileSize: "64MB", maxFileCount: 10 },
  })
    .middleware(() => ({}))
    .onUploadComplete(({ file }) => ({ url: file.ufsUrl })),

  registrationFile: f({
    image: { maxFileSize: "8MB", maxFileCount: 1 },
    pdf: { maxFileSize: "8MB", maxFileCount: 1 },
  })
    .middleware(() => ({}))
    .onUploadComplete(({ file }) => ({ url: file.ufsUrl })),

  organizationLogo: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .middleware(() => ({}))
    .onUploadComplete(({ file }) => ({ url: file.ufsUrl })),

  organizationCover: f({ image: { maxFileSize: "16MB", maxFileCount: 1 } })
    .middleware(() => ({}))
    .onUploadComplete(({ file }) => ({ url: file.ufsUrl })),

  organizationPolicyDocument: f({ pdf: { maxFileSize: "8MB", maxFileCount: 1 } })
    .middleware(() => ({}))
    .onUploadComplete(({ file }) => ({ url: file.ufsUrl })),

  partnerLogo: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .middleware(() => ({}))
    .onUploadComplete(({ file }) => ({ url: file.ufsUrl })),

  // Distinct from "teamLogo" above, which belongs to the pre-existing
  // captain-owned "team" table (CreateTeamModal.tsx) — this one is for the
  // new organization-owned "organization_team" rows (organizer-teams.ts).
  organizationTeamLogo: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .middleware(() => ({}))
    .onUploadComplete(({ file }) => ({ url: file.ufsUrl })),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
