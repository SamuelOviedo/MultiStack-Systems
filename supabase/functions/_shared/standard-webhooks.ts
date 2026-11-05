/**
 * Standard Webhooks signature verification (https://www.standardwebhooks.com),
 * the scheme Supabase Auth uses to sign HTTP hooks such as the Send Email Hook.
 *
 *   signed content = `${webhook-id}.${webhook-timestamp}.${raw body}`
 *   signature      = base64(HMAC-SHA256(secret, signed content))
 *   header         = "webhook-signature: v1,<sig> [v1,<sig> …]"
 *
 * The secret is the value Supabase shows for the hook ("v1,whsec_<base64>").
 * Implemented on WebCrypto (Deno + Node ≥ 20) with no third-party dependency;
 * HMAC comparison goes through crypto.subtle.verify (constant time).
 */

export class WebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookVerificationError";
  }
}

/** Accepted clock skew between Supabase Auth and this function (seconds). */
export const DEFAULT_TOLERANCE_SECONDS = 5 * 60;

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** "v1,whsec_<base64>" | "whsec_<base64>" | "<base64>" → raw key bytes. */
export function decodeWebhookSecret(secret: string): Uint8Array<ArrayBuffer> {
  let value = secret.trim();
  if (value.startsWith("v1,")) value = value.slice(3);
  if (value.startsWith("whsec_")) value = value.slice(6);
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = base64ToBytes(value);
  } catch {
    throw new WebhookVerificationError("Webhook secret is not valid base64");
  }
  if (bytes.length < 16) throw new WebhookVerificationError("Webhook secret is too short");
  return bytes;
}

export interface VerifyOptions {
  toleranceSeconds?: number;
  /** Current time in ms (injectable for tests). */
  now?: () => number;
}

/**
 * Throws WebhookVerificationError unless `body` carries a valid, fresh
 * signature. `body` must be the raw request text (verify BEFORE JSON.parse).
 */
export async function verifyStandardWebhook(
  body: string,
  headers: Headers,
  secret: string,
  options: VerifyOptions = {},
): Promise<void> {
  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signatureHeader = headers.get("webhook-signature");
  if (!id || !timestamp || !signatureHeader) {
    throw new WebhookVerificationError("Missing webhook signature headers");
  }
  if (!/^\d{1,12}$/.test(timestamp)) {
    throw new WebhookVerificationError("Invalid webhook timestamp");
  }

  const tolerance = options.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  const nowSeconds = Math.floor((options.now?.() ?? Date.now()) / 1000);
  if (Math.abs(nowSeconds - Number(timestamp)) > tolerance) {
    throw new WebhookVerificationError("Webhook timestamp outside tolerance");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    decodeWebhookSecret(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const signedContent = new TextEncoder().encode(`${id}.${timestamp}.${body}`);

  for (const candidate of signatureHeader.split(" ")) {
    const [version, signature] = candidate.split(",", 2);
    if (version !== "v1" || !signature) continue;
    let signatureBytes: Uint8Array<ArrayBuffer>;
    try {
      signatureBytes = base64ToBytes(signature);
    } catch {
      continue;
    }
    if (await crypto.subtle.verify("HMAC", key, signatureBytes, signedContent)) return;
  }
  throw new WebhookVerificationError("No matching webhook signature");
}
