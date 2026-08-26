export const SUPPORTED_LINKEDIN_CSV = /^(profile(?:_v2)?|skills?|positions?|experience|education|projects?|certifications?|languages?|courses?|honors?|awards?|publications?)\.csv$/i;

export function importFileBaseName(value: string) {
  return value.replace(/\\/g, '/').split('/').pop() ?? value;
}

export function isSupportedLinkedInCsvFile(value: string) {
  return SUPPORTED_LINKEDIN_CSV.test(importFileBaseName(value));
}
