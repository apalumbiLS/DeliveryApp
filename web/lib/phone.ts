/**
 * US phone numbers, formatted after the fact rather than masked while typing:
 * a mask fights paste, autofill, and editing in the middle of a number.
 */

/**
 * `(864) 555-0147` for a 10-digit US number, with or without a leading 1.
 * Anything else — an extension, a foreign number — comes back as typed, so a
 * number we don't understand is never mangled.
 */
export function formatPhone(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  const national =
    digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;

  if (national.length !== 10 || /[^\d\s().+-]/.test(trimmed)) return trimmed;

  return `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`;
}
