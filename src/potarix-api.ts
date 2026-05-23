export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };
export type RequestBody = { [key: string]: JsonValue | undefined };

export const DEFAULT_API_BASE = "https://api.potarix.com/enricher";

export class PotarixApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly detail?: unknown
  ) {
    super(message);
    this.name = "PotarixApiError";
  }
}

function apiBase(): string {
  return process.env.POTARIX_API?.replace(/\/+$/, "") || DEFAULT_API_BASE;
}

function apiKey(): string {
  const key = process.env.POTARIX_API_KEY;
  if (!key) {
    throw new PotarixApiError("Set POTARIX_API_KEY to call Potarix Enricher tools.");
  }
  return key;
}

function cleanBody(body: RequestBody): JsonObject {
  return Object.fromEntries(
    Object.entries(body).filter(([, value]) => value !== undefined && value !== "")
  ) as JsonObject;
}

function stringifyDetail(detail: unknown): string {
  if (!detail) return "Unknown error";
  if (typeof detail === "string") return detail;
  if (typeof detail === "object" && "detail" in detail) {
    return stringifyDetail((detail as { detail: unknown }).detail);
  }
  try {
    return JSON.stringify(detail);
  } catch {
    return String(detail);
  }
}

export async function postPotarix(path: string, body: RequestBody): Promise<JsonValue> {
  const response = await fetch(`${apiBase()}${path}`, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Authorization": `Bearer ${apiKey()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(cleanBody(body))
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new PotarixApiError(
      `Potarix API returned HTTP ${response.status}: ${stringifyDetail(payload)}`,
      response.status,
      payload
    );
  }

  return payload;
}

export function asJsonText(value: JsonValue): string {
  return JSON.stringify(value, null, 2);
}
