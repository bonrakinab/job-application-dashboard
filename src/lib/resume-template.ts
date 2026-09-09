/**
 * Canonical layout constants for the uploaded one-page LaTeX resume reference.
 * The PDF renderer consumes this module so template changes are versioned and
 * can invalidate previously generated application packs.
 */
export const RESUME_TEMPLATE_VERSION = 'arnob-reference-one-page.v10';

export const RESUME_PAGE = {
  width: 595.28,
  height: 841.89,
  margin: 28,
  bottom: 24,
} as const;

// Kept for backwards compatibility with the legacy renderer. The active
// application renderer chooses the largest safe scale while preserving every
// evidence item selected for the one-page pack.
export const RESUME_LAYOUT_ATTEMPTS = [
  { scale: 1.12, maxExperienceBullets: 3, maxProjects: 3, maxProjectBullets: 3 },
  { scale: 1.06, maxExperienceBullets: 3, maxProjects: 3, maxProjectBullets: 3 },
  { scale: 1, maxExperienceBullets: 3, maxProjects: 3, maxProjectBullets: 3 },
  { scale: 0.96, maxExperienceBullets: 3, maxProjects: 3, maxProjectBullets: 3 },
  { scale: 0.92, maxExperienceBullets: 3, maxProjects: 3, maxProjectBullets: 3 },
  { scale: 0.88, maxExperienceBullets: 3, maxProjects: 3, maxProjectBullets: 3 },
  { scale: 0.84, maxExperienceBullets: 3, maxProjects: 3, maxProjectBullets: 3 },
] as const;
