import { Toast, showToast } from "@raycast/api";

type Fetcher = typeof fetch;

export type AuthStrategy = "application-password";

export interface SiteCredentials {
  username: string;
  applicationPassword: string;
  authStrategy: AuthStrategy;
}

export interface SiteConnection {
  baseUrl: string;
  restBase?: string;
}

export interface SiteCapabilities {
  categories: boolean;
  tags: boolean;
  media: boolean;
}

export interface ValidatedSite {
  capabilities: SiteCapabilities;
  user?: WPUser;
}

export interface WPUser {
  id: number;
  name: string;
  slug: string;
  avatar_urls?: Record<string, string>;
}

export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/$/, "");
}

export function normalizeRestBase(restBase?: string): string {
  if (!restBase || restBase.trim() === "") {
    return "/wp-json/wp/v2/";
  }

  const trimmed = restBase.replace(/^\/+/, "");
  const withTrailingSlash = trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
  return withTrailingSlash.startsWith("wp-json") ? `/${withTrailingSlash}` : `/${withTrailingSlash}`;
}

export function buildApiUrl(connection: SiteConnection, route: string): string {
  const baseUrl = normalizeBaseUrl(connection.baseUrl);
  const restBase = normalizeRestBase(connection.restBase);
  const normalizedRoute = route.replace(/^\/+/, "");
  return `${baseUrl}${restBase}${normalizedRoute}`;
}

export function buildAuthHeader(credentials: SiteCredentials): string {
  const token = Buffer.from(`${credentials.username}:${credentials.applicationPassword}`, "utf8").toString("base64");
  return `Basic ${token}`;
}

export async function fetchJson<T>(url: string, credentials: SiteCredentials, fetcher: Fetcher = fetch): Promise<T> {
  const response = await fetcher(url, {
    method: "GET",
    headers: {
      Authorization: buildAuthHeader(credentials),
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const message = await extractErrorMessage(response);
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export async function validateSiteConnection(
  connection: SiteConnection,
  credentials: SiteCredentials,
  fetcher: Fetcher = fetch,
): Promise<ValidatedSite> {
  const validationToast = await showToast({ style: Toast.Style.Animated, title: "Validating site credentials" });

  try {
    const url = buildApiUrl(connection, "users/me");
    const user = await fetchJson<WPUser>(url, credentials, fetcher);

    const capabilities: SiteCapabilities = {
      categories: true,
      tags: true,
      media: true,
    };

    validationToast.style = Toast.Style.Success;
    validationToast.title = "Connection validated";
    validationToast.message = `Authenticated as ${user.name}`;

    return { user, capabilities };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to validate credentials";
    validationToast.style = Toast.Style.Failure;
    validationToast.title = "Validation failed";
    validationToast.message = message;
    throw error;
  }
}

async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { message?: string };
    if (data?.message) return data.message;
  } catch (error) {
    console.error("Failed to parse error response", error);
  }

  return `${response.status} ${response.statusText}`;
}
