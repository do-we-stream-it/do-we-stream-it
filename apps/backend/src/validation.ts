const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const COUNTRY_RE = /^[A-Za-z]{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const DEFAULT_COUNTRY = 'DE';

export class ValidationError extends Error {}

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function parseDate(value: unknown): string {
  if (typeof value !== 'string') throw new ValidationError('date must be a string in YYYY-MM-DD format.');
  const match = DATE_RE.exec(value);
  if (match) {
    const [, y, m, d] = match.map(Number) as [number, number, number, number];
    const parsed = new Date(Date.UTC(y, m - 1, d));
    if (parsed.getUTCFullYear() === y && parsed.getUTCMonth() === m - 1 && parsed.getUTCDate() === d) {
      return value;
    }
  }
  throw new ValidationError('date must be a real calendar day in YYYY-MM-DD format.');
}

export function parseCountry(value: unknown): string {
  if (typeof value !== 'string' || !COUNTRY_RE.test(value)) {
    throw new ValidationError('country must be a two-letter region code such as DE.');
  }
  return value.toUpperCase();
}

export function parseUuid(value: unknown): string {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw new ValidationError('jobId must be a valid UUID.');
  }
  return value.toLowerCase();
}

export function parseDateAndCountry(input: Record<string, unknown>): { date: string; country: string } {
  return {
    date: input.date === undefined ? todayUtc() : parseDate(input.date),
    country: input.country === undefined ? DEFAULT_COUNTRY : parseCountry(input.country),
  };
}
