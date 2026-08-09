/**
 * Canonical layout constants for the uploaded one-page LaTeX resume reference.
 * The PDF renderer consumes this module so template changes are versioned and
 * can invalidate previously generated application packs.
 */
export const RESUME_TEMPLATE_VERSION = 'arnob-latex-reference.v3';

export const RESUME_PAGE = {
  width: 595.28,
  height: 841.89,
  margin: 28,
  bottom: 24,
} as const;

export const RESUME_LAYOUT_ATTEMPTS = [
  { scale: 1, maxExperienceBullets: 3, maxProjects: 4, maxProjectBullets: 2 },
  { scale: 0.94, maxExperienceBullets: 3, maxProjects: 4, maxProjectBullets: 2 },
  { scale: 0.90, maxExperienceBullets: 2, maxProjects: 3, maxProjectBullets: 2 },
  { scale: 0.86, maxExperienceBullets: 2, maxProjects: 3, maxProjectBullets: 1 },
] as const;
