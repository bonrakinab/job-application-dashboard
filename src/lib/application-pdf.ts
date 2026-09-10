// Canonical PDF entry point. Keeping this compatibility module means every
// existing route/test/import automatically uses the same v12 resume renderer.
export { resumePdf } from './reference-resume-pdf';

// Cover letters use their dedicated professional one-page renderer.
export { coverLetterPdf } from './indeed-cover-letter-pdf';
