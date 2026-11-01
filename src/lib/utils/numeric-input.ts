export function sanitizeWholeNumberInput(value: string) {
  return value.replace(/\D/g, '');
}

export function sanitizeMoneyInput(value: string) {
  const allowedCharacters = value.replace(/[^\d.]/g, '');
  const decimalIndex = allowedCharacters.indexOf('.');
  if (decimalIndex === -1) return allowedCharacters;

  const wholePart = allowedCharacters.slice(0, decimalIndex);
  const decimalPart = allowedCharacters.slice(decimalIndex + 1).replace(/\./g, '').slice(0, 2);
  return `${wholePart}.${decimalPart}`;
}