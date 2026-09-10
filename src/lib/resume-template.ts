/**
 * Canonical layout constants for Arnob's uploaded one-page LaTeX resume reference.
 * Any visual change bumps this version so previously generated packs are stale.
 */
export const RESUME_TEMPLATE_VERSION = 'arnob-reference-faithful.v12';

export const RESUME_PAGE = {
  width: 595.28,
  height: 841.89,
  // Measured from the uploaded reference PDF: content begins at ~33.84 pt.
  margin: 33.84,
  bottom: 18,
} as const;

// The source template is already dense. Never enlarge it above its reference scale.
// Project entries in the supplied template use one concise evidence bullet each.
export const RESUME_LAYOUT_ATTEMPTS = [
  { scale: 1.00, maxExperienceBullets: 3, maxProjects: 3, maxProjectBullets: 1 },
  { scale: 0.97, maxExperienceBullets: 3, maxProjects: 3, maxProjectBullets: 1 },
  { scale: 0.94, maxExperienceBullets: 3, maxProjects: 3, maxProjectBullets: 1 },
  { scale: 0.91, maxExperienceBullets: 3, maxProjects: 3, maxProjectBullets: 1 },
  { scale: 0.88, maxExperienceBullets: 3, maxProjects: 3, maxProjectBullets: 1 },
] as const;
