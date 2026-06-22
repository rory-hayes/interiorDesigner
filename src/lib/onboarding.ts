import type { ProjectPreferences, RoomType } from "../types";

export const authSessionStorageKey = "roomwise.auth.session.v1";
export const projectStorageKey = "roomwise.project.v1";
export const signupDraftStorageKey = "roomwise.signup.draft.v1";

const legacySignupStorageKey = "roomwise-signup-profile";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthSession {
  user: AuthUser;
  accessToken?: string;
  provider: "google" | "email" | "demo";
  createdAt: string;
}

export interface ProjectSetupInput {
  name: string;
  roomType: RoomType;
  location: string;
  budget?: number;
}

export interface OnboardingProject extends ProjectSetupInput {
  id: string;
  ownerId: string;
  onboardingStatus: "project_created" | "photo_uploaded" | "brief_completed" | "shopping_ready";
  createdAt: string;
  updatedAt: string;
}

export interface SignupDraft {
  name: string;
  email: string;
}

const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {};

export const supabaseConfig = {
  url: viteEnv.VITE_SUPABASE_URL,
  anonKey: viteEnv.VITE_SUPABASE_ANON_KEY,
};

export function isSupabaseConfigured() {
  return Boolean(supabaseConfig.url && supabaseConfig.anonKey);
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function createId(prefix: string) {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 14);

  return `${prefix}_${id}`;
}

function normalizeAuthSession(value: unknown): AuthSession | null {
  if (!isRecord(value) || !isRecord(value.user)) {
    return null;
  }

  const email = cleanText(value.user.email, 254).toLowerCase();
  const name = cleanText(value.user.name, 80);
  const id = cleanText(value.user.id, 120);
  const provider = value.provider === "google" || value.provider === "email" ? value.provider : "demo";

  if (!id || !name || !isValidEmail(email)) {
    return null;
  }

  return {
    user: { id, email, name },
    accessToken: cleanText(value.accessToken, 2048) || undefined,
    provider,
    createdAt: cleanText(value.createdAt, 40) || new Date().toISOString(),
  };
}

export function readAuthSession(storage: Storage = window.localStorage): AuthSession | null {
  const current = storage.getItem(authSessionStorageKey);
  const session = current ? normalizeAuthSession(safeJsonParse(current)) : null;

  if (session) {
    return session;
  }

  const legacy = storage.getItem(legacySignupStorageKey);
  const parsedLegacy = legacy ? safeJsonParse(legacy) : null;

  if (!isRecord(parsedLegacy)) {
    return null;
  }

  const email = cleanText(parsedLegacy.email, 254).toLowerCase();
  const name = cleanText(parsedLegacy.name, 80);

  if (!name || !isValidEmail(email)) {
    return null;
  }

  return createDemoAuthSession({ name, email });
}

export function saveAuthSession(session: AuthSession, storage: Storage = window.localStorage) {
  try {
    storage.setItem(authSessionStorageKey, JSON.stringify(session));
  } catch {
    // Auth can continue in memory if local storage is unavailable.
  }
}

export function clearAuthSession(storage: Storage = window.localStorage) {
  try {
    storage.removeItem(authSessionStorageKey);
    storage.removeItem(legacySignupStorageKey);
  } catch {
    // Ignore storage failures during sign-out.
  }
}

export function readSignupDraft(storage: Storage = window.localStorage): SignupDraft {
  const rawDraft = storage.getItem(signupDraftStorageKey);
  const parsedDraft = rawDraft ? safeJsonParse(rawDraft) : null;
  const legacy = storage.getItem(legacySignupStorageKey);
  const parsedLegacy = legacy ? safeJsonParse(legacy) : null;
  const source = isRecord(parsedDraft) ? parsedDraft : isRecord(parsedLegacy) ? parsedLegacy : {};

  return {
    name: cleanText(source.name, 80),
    email: cleanText(source.email, 254).toLowerCase(),
  };
}

export function saveSignupDraft(draft: SignupDraft, storage: Storage = window.localStorage) {
  storage.setItem(signupDraftStorageKey, JSON.stringify(draft));
}

export function createDemoAuthSession(input: SignupDraft): AuthSession {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();

  return {
    user: {
      id: createId("user"),
      email,
      name,
    },
    provider: "demo",
    createdAt: new Date().toISOString(),
  };
}

export function buildGoogleOAuthUrl(redirectTo: string) {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const url = new URL(`${supabaseConfig.url}/auth/v1/authorize`);
  url.searchParams.set("provider", "google");
  url.searchParams.set("redirect_to", redirectTo);

  return url.toString();
}

export async function requestEmailMagicLink(email: string, redirectTo: string) {
  if (!isSupabaseConfigured()) {
    return { mode: "demo" as const };
  }

  const response = await fetch(`${supabaseConfig.url}/auth/v1/otp`, {
    method: "POST",
    headers: {
      apikey: supabaseConfig.anonKey!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      type: "magiclink",
      options: {
        emailRedirectTo: redirectTo,
      },
    }),
  });

  if (!response.ok) {
    throw new Error("Could not send sign-in link.");
  }

  return { mode: "supabase" as const };
}

export async function readSupabaseSessionFromUrl(url: string = window.location.href): Promise<AuthSession | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const parsedUrl = new URL(url);
  const hashParams = new URLSearchParams(parsedUrl.hash.replace(/^#/, ""));
  const queryParams = parsedUrl.searchParams;
  const accessToken = hashParams.get("access_token") ?? queryParams.get("access_token");

  if (!accessToken) {
    return null;
  }

  const response = await fetch(`${supabaseConfig.url}/auth/v1/user`, {
    headers: {
      apikey: supabaseConfig.anonKey!,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Could not load Supabase user.");
  }

  const user = (await response.json()) as {
    id?: string;
    email?: string;
    user_metadata?: {
      name?: string;
      full_name?: string;
    };
  };
  const email = cleanText(user.email, 254).toLowerCase();
  const name = cleanText(user.user_metadata?.name ?? user.user_metadata?.full_name, 80) || email.split("@")[0];
  const id = cleanText(user.id, 120);

  if (!id || !isValidEmail(email)) {
    return null;
  }

  return {
    user: { id, email, name },
    accessToken,
    provider: hashParams.get("provider_token") || queryParams.get("provider_token") ? "google" : "email",
    createdAt: new Date().toISOString(),
  };
}

function normalizeProject(value: unknown): OnboardingProject | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = cleanText(value.id, 120);
  const ownerId = cleanText(value.ownerId, 120);
  const name = cleanText(value.name, 100);
  const location = cleanText(value.location, 120);
  const roomType = value.roomType === "bedroom" || value.roomType === "home-office" ? value.roomType : "living-room";
  const budget = Number(value.budget);

  if (!id || !ownerId || !name || !location) {
    return null;
  }

  return {
    id,
    ownerId,
    name,
    roomType,
    location,
    budget: Number.isFinite(budget) && budget > 0 ? budget : undefined,
    onboardingStatus:
      value.onboardingStatus === "photo_uploaded" ||
      value.onboardingStatus === "brief_completed" ||
      value.onboardingStatus === "shopping_ready"
        ? value.onboardingStatus
        : "project_created",
    createdAt: cleanText(value.createdAt, 40) || new Date().toISOString(),
    updatedAt: cleanText(value.updatedAt, 40) || new Date().toISOString(),
  };
}

export function readOnboardingProject(
  ownerId: string | undefined,
  storage: Storage = window.localStorage,
): OnboardingProject | null {
  if (!ownerId) {
    return null;
  }

  const rawProject = storage.getItem(projectStorageKey);
  const project = rawProject ? normalizeProject(safeJsonParse(rawProject)) : null;

  return project?.ownerId === ownerId ? project : null;
}

export function createOnboardingProject(input: ProjectSetupInput, ownerId: string): OnboardingProject {
  const now = new Date().toISOString();

  return {
    id: createId("project"),
    ownerId,
    name: input.name.trim(),
    roomType: input.roomType,
    location: input.location.trim(),
    budget: input.budget,
    onboardingStatus: "project_created",
    createdAt: now,
    updatedAt: now,
  };
}

export function saveOnboardingProject(project: OnboardingProject, storage: Storage = window.localStorage) {
  try {
    storage.setItem(projectStorageKey, JSON.stringify(project));
  } catch {
    // Project remains available in memory if local storage is unavailable.
  }
}

export function clearOnboardingProject(storage: Storage = window.localStorage) {
  try {
    storage.removeItem(projectStorageKey);
  } catch {
    // Ignore storage failures during sign-out/reset.
  }
}

export function projectToPreferences(project: OnboardingProject): Partial<ProjectPreferences> {
  const preferences: Partial<ProjectPreferences> = {
    roomType: project.roomType,
    location: project.location,
  };

  if (typeof project.budget === "number" && Number.isFinite(project.budget) && project.budget > 0) {
    preferences.budget = project.budget;
  }

  return preferences;
}

function projectFromSupabaseRow(row: Record<string, unknown>): OnboardingProject | null {
  return normalizeProject({
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    roomType: row.room_type,
    location: row.location,
    budget: row.budget,
    onboardingStatus: row.onboarding_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export async function fetchLatestSupabaseProject(session: AuthSession): Promise<OnboardingProject | null> {
  if (!isSupabaseConfigured() || !session.accessToken) {
    return null;
  }

  const url = new URL(`${supabaseConfig.url}/rest/v1/projects`);
  url.searchParams.set("owner_id", `eq.${session.user.id}`);
  url.searchParams.set("select", "*");
  url.searchParams.set("order", "created_at.desc");
  url.searchParams.set("limit", "1");

  const response = await fetch(url, {
    headers: {
      apikey: supabaseConfig.anonKey!,
      Authorization: `Bearer ${session.accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Could not load your latest project.");
  }

  const rows = (await response.json()) as Array<Record<string, unknown>>;

  return rows[0] ? projectFromSupabaseRow(rows[0]) : null;
}

export async function saveSupabaseProject(project: OnboardingProject, session: AuthSession) {
  if (!isSupabaseConfigured() || !session.accessToken) {
    return { mode: "local" as const };
  }

  const response = await fetch(`${supabaseConfig.url}/rest/v1/projects`, {
    method: "POST",
    headers: {
      apikey: supabaseConfig.anonKey!,
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      id: project.id,
      owner_id: project.ownerId,
      name: project.name,
      room_type: project.roomType,
      location: project.location,
      budget: project.budget,
      onboarding_status: project.onboardingStatus,
      preferences: {},
      created_at: project.createdAt,
      updated_at: project.updatedAt,
    }),
  });

  if (!response.ok) {
    throw new Error("Could not save the project to Supabase.");
  }

  return { mode: "supabase" as const };
}

function safeStorageFileName(name: string) {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return cleaned || "room-photo.webp";
}

export async function saveRoomPhotoAsset(input: {
  session: AuthSession;
  project: OnboardingProject;
  imageDataUrl: string;
  name: string;
  type: string;
  size: number;
  sourceDevice: "desktop" | "phone-capture";
}) {
  if (!isSupabaseConfigured() || !input.session.accessToken) {
    return { mode: "local" as const };
  }

  const blob = await fetch(input.imageDataUrl).then((response) => response.blob());
  const objectPath = `${input.session.user.id}/${input.project.id}/${Date.now()}-${safeStorageFileName(input.name)}`;
  const uploadResponse = await fetch(`${supabaseConfig.url}/storage/v1/object/room-photos/${objectPath}`, {
    method: "PUT",
    headers: {
      apikey: supabaseConfig.anonKey!,
      Authorization: `Bearer ${input.session.accessToken}`,
      "Content-Type": input.type,
      "x-upsert": "false",
    },
    body: blob,
  });

  if (!uploadResponse.ok) {
    throw new Error("Could not save the room photo to private storage.");
  }

  const assetResponse = await fetch(`${supabaseConfig.url}/rest/v1/room_assets`, {
    method: "POST",
    headers: {
      apikey: supabaseConfig.anonKey!,
      Authorization: `Bearer ${input.session.accessToken}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      project_id: input.project.id,
      owner_id: input.session.user.id,
      storage_path: objectPath,
      source_device: input.sourceDevice,
      mime_type: input.type,
      size_bytes: input.size,
    }),
  });

  if (!assetResponse.ok) {
    throw new Error("Could not save the room photo record.");
  }

  return { mode: "supabase" as const, storagePath: objectPath };
}
