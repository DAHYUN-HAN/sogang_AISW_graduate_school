export type CouncilMemberFormData = {
  name: string;
  cohort: string;
  role: string;
  image_url: string;
  intro: string;
};

export type FixedCouncilMemberProfile = {
  name: string;
  subtitle: string;
  imageUrl: string;
};

export type CouncilIntroductionContent = {
  representativeImages: string[];
  textSections: { kind: "greeting" | "intro"; text: string }[];
};

export function councilIntroductionContent({
  photoUrls,
  bannerImageUrl,
  greeting,
  intro,
}: {
  photoUrls: string[];
  bannerImageUrl?: string;
  greeting?: string;
  intro?: string;
}): CouncilIntroductionContent {
  const gallery = photoUrls.map((url) => url.trim()).filter(Boolean);
  const banner = bannerImageUrl?.trim();
  const representativeImages = gallery.length > 0 ? gallery : banner ? [banner] : [];
  const greetingText = greeting?.trim();
  const introText = intro?.trim();

  return {
    representativeImages,
    textSections: [
      ...(greetingText ? [{ kind: "greeting" as const, text: greetingText }] : []),
      ...(introText ? [{ kind: "intro" as const, text: introText }] : []),
    ],
  };
}

export function fixedCouncilMemberProfile(
  member: CouncilMemberFormData,
  fallbackCohort = "",
): FixedCouncilMemberProfile {
  return {
    name: member.name.trim(),
    subtitle: [member.cohort.trim() || fallbackCohort.trim(), member.role.trim()].filter(Boolean).join(" "),
    imageUrl: member.image_url.trim(),
  };
}

export type CurrentCouncilFormData = {
  title: string;
  greeting: string;
  intro: string;
  banner_image_url: string;
  photo_urls?: string[];
  members: CouncilMemberFormData[];
};

export type CurrentCouncilScreenState =
  | { kind: "detail"; council: CurrentCouncilFormData }
  | { kind: "empty" };

export type CohortLeaderFormData = {
  cohort: string;
  greeting: string;
  intro: string;
  banner_image_url: string;
  photo_urls?: string[];
  members: CouncilMemberFormData[];
};

export type PastCouncilFormData = {
  cohort: string;
  greeting: string;
  intro: string;
  banner_image_url: string;
  photo_urls?: string[];
  activities: unknown[];
  members: CouncilMemberFormData[];
};


function photoUrlsFromValue(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((url) => {
    if (typeof url !== "string") return [];
    const normalized = url.trim();
    if (!normalized || seen.has(normalized)) return [];
    seen.add(normalized);
    return [normalized];
  });
}

export function councilGalleryFields({
  photoUrls,
  attachmentUrls,
  bannerImageUrl,
}: {
  photoUrls?: unknown;
  attachmentUrls?: unknown;
  bannerImageUrl?: unknown;
}) {
  const photos = photoUrlsFromValue(photoUrls);
  const legacyAttachments = photoUrlsFromValue(attachmentUrls);
  const banner = typeof bannerImageUrl === "string" ? bannerImageUrl.trim() : "";
  const gallery = photos.length > 0
    ? photos
    : legacyAttachments.length > 0
      ? legacyAttachments
      : banner
        ? [banner]
        : [];

  return {
    photo_urls: gallery,
    attachment_urls: [...gallery],
    banner_image_url: gallery[0] ?? "",
  };
}

function hasCompleteCouncilMembers(members: CouncilMemberFormData[]): boolean {
  return members.every((member) => (
    Boolean(member.name.trim())
    && Boolean(member.cohort.trim())
    && Boolean(member.role.trim())
  ));
}

export function canSaveCurrentCouncilCards(cards: CurrentCouncilFormData[]): boolean {
  return cards.length === 1 && cards.every((card) => (
    Boolean(card.title.trim())
    && Boolean(card.intro.trim())
    && hasCompleteCouncilMembers(card.members)
  ));
}

export function canSaveCohortLeaderCards(cards: CohortLeaderFormData[]): boolean {
  return cards.every((card) => (
    Boolean(card.cohort.trim())
    && Boolean(card.intro.trim())
    && hasCompleteCouncilMembers(card.members)
  ));
}

export function canSavePastCouncilCards(cards: PastCouncilFormData[]): boolean {
  return cards.every((card) => (
    Boolean(card.cohort.trim())
    && Boolean(card.intro.trim())
    && hasCompleteCouncilMembers(card.members)
  ));
}

export function moveCouncilIntroductionItem<T>(items: readonly T[], fromIndex: number, toIndex: number): T[] {
  const next = [...items];
  if (
    fromIndex < 0
    || fromIndex >= next.length
    || toIndex < 0
    || toIndex >= next.length
    || fromIndex === toIndex
  ) {
    return next;
  }
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

export function sortCouncilCardsDescending<T extends { cohort: string }>(cards: readonly T[]): T[] {
  return cards
    .map((card, index) => ({
      card,
      index,
      cohortNumber: Number.parseInt(card.cohort.match(/\d+/)?.[0] ?? "", 10),
    }))
    .sort((left, right) => {
      const leftIsNumeric = Number.isFinite(left.cohortNumber);
      const rightIsNumeric = Number.isFinite(right.cohortNumber);
      if (leftIsNumeric && rightIsNumeric) {
        return right.cohortNumber - left.cohortNumber || left.index - right.index;
      }
      if (leftIsNumeric) return -1;
      if (rightIsNumeric) return 1;
      return left.index - right.index;
    })
    .map(({ card }) => card);
}

type Metadata = Record<string, unknown> | null | undefined;

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function stringValue(record: Record<string, unknown>, key: string) {
  return typeof record[key] === "string" ? (record[key] as string).trim() : "";
}

function cohortWithSuffix(value: string) {
  const trimmed = value.trim();
  return trimmed && !trimmed.endsWith("기") ? `${trimmed}기` : trimmed;
}

function withoutCohortSuffix(value: string) {
  return value.trim().replace(/기$/, "");
}

function withoutCouncilSuffix(value: string) {
  return value.trim().replace(/[기대]$/, "");
}

function membersFromValue(value: unknown): CouncilMemberFormData[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const record = recordValue(item);
    if (!record) return [];
    const member = {
      name: stringValue(record, "name"),
      cohort: stringValue(record, "cohort"),
      role: stringValue(record, "role"),
      image_url: stringValue(record, "image_url"),
      intro: stringValue(record, "intro"),
    };
    return member.name || member.cohort || member.role || member.image_url || member.intro ? [member] : [];
  });
}

function legacyMember(
  record: Record<string, unknown>,
  nameKey: string,
  cohortKey: string,
  role: string,
  imageKey: string,
  fallbackCohort = "",
): CouncilMemberFormData[] {
  const name = stringValue(record, nameKey);
  if (!name) return [];
  return [{
    name,
    cohort: cohortWithSuffix(stringValue(record, cohortKey) || fallbackCohort),
    role,
    image_url: stringValue(record, imageKey),
    intro: "",
  }];
}

export function currentCouncilFormsFromMetadata(metadata: Metadata): CurrentCouncilFormData[] {
  const legacyMembers = membersFromValue(metadata?.executives);
  const configured = metadata?.council_introductions;
  if (Array.isArray(configured)) {
    const cards = configured.flatMap((item) => {
      const record = recordValue(item);
      if (!record) return [];
      const configuredMembers = membersFromValue(record.members);
      const members = configuredMembers.length > 0 ? configuredMembers : legacyMembers;
      const title = stringValue(record, "title");
      if (!title && members.length === 0) return [];
      const gallery = councilGalleryFields({
        photoUrls: record.photo_urls,
        attachmentUrls: record.attachment_urls,
        bannerImageUrl: record.banner_image_url,
      });
      return [{
        title: title || "현재 원우회",
        greeting: stringValue(record, "greeting"),
        intro: stringValue(record, "intro"),
        banner_image_url: gallery.banner_image_url,
        photo_urls: gallery.photo_urls,
        members,
      }];
    });
    if (cards.length > 0) return cards;
  }

  return legacyMembers.length > 0 ? [{
    title: "현재 원우회",
    greeting: "",
    intro: "",
    banner_image_url: "",
    photo_urls: [],
    members: legacyMembers,
  }] : [];
}

export function currentCouncilScreenState(metadata: Metadata): CurrentCouncilScreenState {
  const council = currentCouncilFormsFromMetadata(metadata)[0];
  return council ? { kind: "detail", council } : { kind: "empty" };
}

export function cohortLeaderFormsFromMetadata(metadata: Metadata): CohortLeaderFormData[] {
  const configured = metadata?.cohort_leaders;
  if (!Array.isArray(configured)) return [];
  return configured.flatMap((item) => {
    const record = recordValue(item);
    if (!record) return [];
    const cohort = withoutCohortSuffix(stringValue(record, "cohort"));
    let members = membersFromValue(record.members);
    if (members.length === 0) {
      members = [
        ...legacyMember(record, "captain_name", "captain_cohort", "기장", "captain_image_url", cohort),
        ...legacyMember(record, "vice_captain_name", "vice_captain_cohort", "부기장", "vice_captain_image_url", cohort),
      ];
    }
    if (!cohort && members.length === 0) return [];
    const gallery = councilGalleryFields({
      photoUrls: record.photo_urls,
      attachmentUrls: record.attachment_urls,
      bannerImageUrl: record.banner_image_url,
    });
    return [{
      cohort,
      greeting: stringValue(record, "greeting"),
      intro: stringValue(record, "intro"),
      banner_image_url: gallery.banner_image_url,
      photo_urls: gallery.photo_urls,
      members,
    }];
  });
}

export function pastCouncilFormsFromMetadata(metadata: Metadata): PastCouncilFormData[] {
  const configured = metadata?.past_councils;
  if (!Array.isArray(configured)) return [];
  return configured.flatMap((item) => {
    const record = recordValue(item);
    if (!record) return [];
    const cohort = withoutCouncilSuffix(stringValue(record, "cohort"));
    let members = membersFromValue(record.members);
    if (members.length === 0) {
      members = [
        ...legacyMember(record, "president_name", "president_cohort", "회장", "president_image_url"),
        ...legacyMember(record, "vice_president_name", "vice_president_cohort", "부회장", "vice_president_image_url"),
      ];
    }
    if (!cohort && members.length === 0) return [];
    const gallery = councilGalleryFields({
      photoUrls: record.photo_urls,
      attachmentUrls: record.attachment_urls,
      bannerImageUrl: record.banner_image_url,
    });
    return [{
      cohort,
      greeting: stringValue(record, "greeting"),
      intro: stringValue(record, "intro"),
      banner_image_url: gallery.banner_image_url,
      photo_urls: gallery.photo_urls,
      activities: Array.isArray(record.activities) ? record.activities : [],
      members,
    }];
  });
}

export function withCurrentCouncilMetadata(metadata: Metadata, cards: CurrentCouncilFormData[]) {
  const current = cards.slice(0, 1).map((card) => ({
    ...card,
    ...councilGalleryFields({
      photoUrls: card.photo_urls,
      bannerImageUrl: card.banner_image_url,
    }),
  }));
  return {
    ...(metadata ?? {}),
    council_introductions: current,
    executives: current.flatMap((card) => card.members),
  };
}

export function withCohortLeaderMetadata(metadata: Metadata, cards: CohortLeaderFormData[]) {
  return {
    ...(metadata ?? {}),
    cohort_leaders: cards.map((card) => {
      const captain = card.members.find((member) => member.role.trim() === "기장") ?? card.members[0];
      const viceCaptain = card.members.find((member) => member.role.trim() === "부기장");
      const gallery = councilGalleryFields({
        photoUrls: card.photo_urls,
        bannerImageUrl: card.banner_image_url,
      });
      return {
        cohort: withoutCohortSuffix(card.cohort),
        greeting: card.greeting,
        intro: card.intro,
        ...gallery,
        members: card.members,
        captain_name: captain?.name ?? "",
        vice_captain_name: viceCaptain?.name ?? "",
        captain_image_url: captain?.image_url ?? "",
        vice_captain_image_url: viceCaptain?.image_url ?? "",
      };
    }),
  };
}

export function withPastCouncilMetadata(metadata: Metadata, cards: PastCouncilFormData[]) {
  return {
    ...(metadata ?? {}),
    past_councils: cards.map((card) => {
      const president = card.members.find((member) => member.role.trim() === "회장") ?? card.members[0];
      const vicePresident = card.members.find((member) => member.role.trim() === "부회장");
      const gallery = councilGalleryFields({
        photoUrls: card.photo_urls,
        bannerImageUrl: card.banner_image_url,
      });
      return {
        cohort: withoutCouncilSuffix(card.cohort),
        greeting: card.greeting,
        intro: card.intro,
        ...gallery,
        activities: card.activities,
        members: card.members,
        president_name: president?.name ?? "",
        president_cohort: withoutCohortSuffix(president?.cohort ?? ""),
        vice_president_name: vicePresident?.name ?? "",
        vice_president_cohort: withoutCohortSuffix(vicePresident?.cohort ?? ""),
        president_image_url: president?.image_url ?? "",
        vice_president_image_url: vicePresident?.image_url ?? "",
      };
    }),
  };
}
