/**
 * Canonical layout constants for the uploaded one-page resume reference.
 * Template-version changes deliberately invalidate stored application packs so
 * the dashboard never presents an older layout as the current resume.
 */
export const RESUME_TEMPLATE_VERSION = 'arnob-reference-one-page.v11';

export const RESUME_PAGE = {
  width: 595.28,
  height: 841.89,
  margin: 28,
  bottom: 24,
} as const;

// The PDF renderer tries the roomiest version first and scales only as much as
// needed to preserve every evidence item selected for the one-page pack.
export const RESUME_LAYOUT_ATTEMPTS = [
  { scale: 1.12, maxExperienceBullets: 3, maxProjects: 3, maxProjectBullets: 3 },
  { scale: 1.06, maxExperienceBullets: 3, maxProjects: 3, maxProjectBullets: 3 },
  { scale: 1, maxExperienceBullets: 3, maxProjects: 3, maxProjectBullets: 3 },
  { scale: 0.96, maxExperienceBullets: 3, maxProjects: 3, maxProjectBullets: 3 },
  { scale: 0.92, maxExperienceBullets: 3, maxProjects: 3, maxProjectBullets: 3 },
  { scale: 0.88, maxExperienceBullets: 3, maxProjects: 3, maxProjectBullets: 3 },
  { scale: 0.84, maxExperienceBullets: 3, maxProjects: 3, maxProjectBullets: 3 },
] as const;
