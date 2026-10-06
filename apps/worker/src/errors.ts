const messages = {
  SOURCE_UNAVAILABLE: 'Die Netflix-Quelle ist derzeit nicht erreichbar.',
  SOURCE_PARSE_FAILED: 'Die Netflix-Quelle konnte nicht vollständig gelesen werden.',
  SOURCE_DATE_UNAVAILABLE: 'Die Quelle enthält keinen Kalender für den angefragten Monat.',
  UNSUPPORTED_COUNTRY: 'Der Scraper unterstützt derzeit nur Deutschland (DE).',
  INVALID_JOB: 'Der Queue-Auftrag passt nicht zum gespeicherten Job.',
  SCRAPE_FAILED: 'Der Scraper-Auftrag konnte nicht abgeschlossen werden.',
} as const;

export type FailureCode = keyof typeof messages;

export class ScraperError extends Error {
  constructor(readonly code: FailureCode, options?: ErrorOptions) {
    super(`[${code}] ${messages[code]}`, options);
  }
}

export function publicFailure(reason: string): { code: FailureCode; message: string } {
  const candidate = /^\[([A-Z_]+)\]/.exec(reason)?.[1];
  const code = candidate && Object.hasOwn(messages, candidate) ? candidate as FailureCode : 'SCRAPE_FAILED';
  return { code, message: messages[code] };
}
