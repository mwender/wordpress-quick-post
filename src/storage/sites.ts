import { LocalStorage } from "@raycast/api";
import { randomUUID } from "crypto";
import {
  SiteCapabilities,
  SiteCredentials,
  SiteConnection,
  normalizeBaseUrl,
  normalizeRestBase,
  validateSiteConnection,
} from "../api/wordpress";

const SITE_INDEX_KEY = "site-index";
const SITE_SECRET_PREFIX = "site-secret-";

export interface SiteMetadata extends SiteConnection {
  id: string;
  name: string;
  restBase: string;
  capabilities?: SiteCapabilities;
  validatedAt?: string;
}

export interface SiteProfile extends SiteMetadata {
  credentials: SiteCredentials;
}

export interface SiteInput extends SiteConnection {
  id?: string;
  name: string;
  username: string;
  applicationPassword: string;
}

export async function getSites(): Promise<SiteProfile[]> {
  const metadata = await loadSiteMetadata();
  const sites: SiteProfile[] = [];

  for (const site of metadata) {
    const credentials = await loadCredentials(site.id);
    if (!credentials) continue;
    sites.push({ ...site, credentials });
  }

  return sites;
}

export async function getSite(id: string): Promise<SiteProfile | undefined> {
  const metadata = await loadSiteMetadata();
  const site = metadata.find((entry) => entry.id === id);
  if (!site) return undefined;

  const credentials = await loadCredentials(id);
  if (!credentials) return undefined;

  return { ...site, credentials };
}

export async function upsertSite(input: SiteInput): Promise<SiteProfile> {
  const id = input.id ?? randomUUID();

  const normalizedBase = normalizeBaseUrl(input.baseUrl);
  const normalizedRest = normalizeRestBase(input.restBase);

  const credentials: SiteCredentials = {
    username: input.username,
    applicationPassword: input.applicationPassword,
    authStrategy: "application-password",
  };

  const validation = await validateSiteConnection({ baseUrl: normalizedBase, restBase: normalizedRest }, credentials);

  const metadataEntry: SiteMetadata = {
    id,
    name: input.name,
    baseUrl: normalizedBase,
    restBase: normalizedRest,
    capabilities: validation.capabilities,
    validatedAt: new Date().toISOString(),
  };

  await saveSiteMetadata(metadataEntry);
  await saveCredentials(id, credentials);

  return { ...metadataEntry, credentials };
}

export async function removeSite(id: string): Promise<void> {
  const metadata = await loadSiteMetadata();
  const filtered = metadata.filter((entry) => entry.id !== id);
  await LocalStorage.setItem(SITE_INDEX_KEY, JSON.stringify(filtered));
  await LocalStorage.removeItem(`${SITE_SECRET_PREFIX}${id}`);
}

async function loadSiteMetadata(): Promise<SiteMetadata[]> {
  const data = await LocalStorage.getItem<string>(SITE_INDEX_KEY);
  if (!data) return [];

  try {
    return JSON.parse(data) as SiteMetadata[];
  } catch (error) {
    console.error("Failed to parse stored site metadata", error);
    return [];
  }
}

async function loadCredentials(id: string): Promise<SiteCredentials | undefined> {
  const data = await LocalStorage.getItem<string>(`${SITE_SECRET_PREFIX}${id}`);
  if (!data) return undefined;

  try {
    return JSON.parse(data) as SiteCredentials;
  } catch (error) {
    console.error("Failed to parse stored credentials", error);
    return undefined;
  }
}

async function saveSiteMetadata(entry: SiteMetadata): Promise<void> {
  const metadata = await loadSiteMetadata();
  const existingIndex = metadata.findIndex((site) => site.id === entry.id);

  if (existingIndex === -1) {
    metadata.push(entry);
  } else {
    metadata[existingIndex] = entry;
  }

  await LocalStorage.setItem(SITE_INDEX_KEY, JSON.stringify(metadata));
}

async function saveCredentials(id: string, credentials: SiteCredentials): Promise<void> {
  await LocalStorage.setItem(`${SITE_SECRET_PREFIX}${id}`, JSON.stringify(credentials));
}
