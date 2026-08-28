/**
 * Canonical layout constants for the uploaded one-page LaTeX resume reference.
 * The PDF renderer consumes this module so template changes are versioned and
 * can invalidate previously generated application packs.
 */
export const RESUME_TEMPLATE_VERSION = 'arnob-latex-reference.v8-stable-one-page';

export const RESUME_PAGE = {
  width: 595.28,
  height: 841.89,
  margin: 28,
  bottom: 24,
} as const;

// Kept for backwards compatibility with the legacy renderer. The active
// application renderer now expands the largest safe content-preserving layout
// before pruning bullets/projects.
export const RESUME_LAYOUT_ATTEMPTS = [
  { scale: 1, maxExperienceBullets: 3, maxProjects: 3, maxProjectBullets: 1 },
  { scale: 0.96, maxExperienceBullets: 3, maxProjects: 3, maxProjectBullets: 1 },
  { scale: 0.92, maxExperienceBullets: 2, maxProjects: 3, maxProjectBullets: 1 },
  { scale: 0.88, maxExperienceBullets: 2, maxProjects: 2, maxProjectBullets: 1 },
  { scale: 0.84, maxExperienceBullets: 2, maxProjects: 1, maxProjectBullets: 1 },
] as const;
