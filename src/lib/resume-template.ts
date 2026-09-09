/**
 * Canonical layout constants for the uploaded one-page LaTeX resume reference.
 * The PDF and DOCX renderers consume this module so template changes are
 * versioned and automatically invalidate older application packs.
 */
export const RESUME_TEMPLATE_VERSION = 'arnob-cm-reference.v11';

export const RESUME_PAGE = {
  width: 595.28,
  height: 841.89,
  // The uploaded A4 reference uses a compact ~20 pt content margin.
  margin: 20,
  bottom: 18,
} as const;

// Preserve the selected evidence whenever possible. Scaling is preferred over
// silently dropping a bullet or certification, because artifact validation must
// compare the actual exported text with the saved application pack.
export const RESUME_LAYOUT_ATTEMPTS = [
  { scale: 1.08, maxExperienceBullets: 3, maxProjects: 3, maxProjectBullets: 3 },
  { scale: 1.04, maxExperienceBullets: 3, maxProjects: 3, maxProjectBullets: 3 },
  { scale: 1, maxExperienceBullets: 3, maxProjects: 3, maxProjectBullets: 3 },
  { scale: 0.96, maxExperienceBullets: 3, maxProjects: 3, maxProjectBullets: 3 },
  { scale: 0.92, maxExperienceBullets: 3, maxProjects: 3, maxProjectBullets: 3 },
  { scale: 0.88, maxExperienceBullets: 3, maxProjects: 3, maxProjectBullets: 3 },
  { scale: 0.84, maxExperienceBullets: 3, maxProjects: 3, maxProjectBullets: 3 },
] as const;
