/**
 * Reply-To for the internal lead notification. Pure module: runs on Deno and
 * under Vitest.
 *
 * The form accepts any `x@y.z` without whitespace (unchanged contract). Only a
 * plain, single address is used as Reply-To: no CR/LF or other whitespace
 * (header injection), no list separators or display-name syntax
 * (`,;<>"'()[]\:`), at most 254 characters. Anything else replies to support;
 * the visitor's address is still shown, escaped, in the message body.
 */
export const SUPPORT_REPLY_TO = "soporte@multistacksystems.com";

const PART = String.raw`[^\s@,;<>"'()[\]\\:]+`;
const PLAIN_ADDRESS_RE = new RegExp(`^${PART}@${PART}\\.${PART}$`);

export function replyToFor(visitorEmail: string): string {
  return visitorEmail.length <= 254 && PLAIN_ADDRESS_RE.test(visitorEmail) ? visitorEmail : SUPPORT_REPLY_TO;
}
