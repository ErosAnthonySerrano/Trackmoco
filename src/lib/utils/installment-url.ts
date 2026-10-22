const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHORT_ID_PATTERN = /^[A-Za-z0-9_-]{8}$/;
const LEGACY_ENCODED_ID_PATTERN = /^[A-Za-z0-9_-]{22}$/;

export function isInstallmentUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function isInstallmentShortId(value: string): boolean {
  return SHORT_ID_PATTERN.test(value);
}

export function decodeLegacyInstallmentId(value: string): string | null {
  if (!LEGACY_ENCODED_ID_PATTERN.test(value)) return null;

  try {
    const base64 = value.replaceAll('-', '+').replaceAll('_', '/') + '==';
    const binary = atob(base64);
    if (binary.length !== 16) return null;

    const hex = Array.from(binary, (character) => character.charCodeAt(0).toString(16).padStart(2, '0')).join('');
    const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    return isInstallmentUuid(uuid) ? uuid : null;
  } catch {
    return null;
  }
}

export function getInstallmentDetailsUrl(shortId: string): string {
  if (!isInstallmentShortId(shortId)) {
    throw new Error('Cannot create an installment URL from an invalid short ID.');
  }
  return `/installment-details/${shortId}`;
}
