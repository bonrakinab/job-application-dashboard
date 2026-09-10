/**
 * Canonical layout constants for Arnob's uploaded one-page LaTeX resume.
 * Any visual change bumps this version so previously generated packs are stale.
 */
export const RESUME_TEMPLATE_VERSION = 'arnob-latex-reference.v15';

export const RESUME_PAGE = {
  width: 595.28,
  height: 841.89,
  // Exact geometry from the canonical TeX source:
  // left/right 0.46in, top 0.35in, bottom 0.34in.
  margin: 33.12,
  top: 25.2,
  bottom: 24.48,
} as const;

/**
 * Never shrink the type to rescue an overcrowded resume. The reference uses a
 * fixed typographic scale. If content is too dense, progressively remove the
 * lowest-value JD-ranked evidence instead of making the page visibly smaller.
 */
export const RESUME_LAYOUT_ATTEMPTS = [
  { scale: 1.00, maxExperienceBullets: 3, maxProjects: 3, maxProjectBullets: 2, maxSkills: 30 },
  { scale: 1.00, maxExperienceBullets: 3, maxProjects: 3, maxProjectBullets: 1, maxSkills: 28 },
  { scale: 1.00, maxExperienceBullets: 2, maxProjects: 3, maxProjectBullets: 1, maxSkills: 26 },
  { scale: 1.00, maxExperienceBullets: 2, maxProjects: 2, maxProjectBullets: 1, maxSkills: 22 },
  { scale: 1.00, maxExperienceBullets: 1, maxProjects: 2, maxProjectBullets: 1, maxSkills: 18 },
] as const;
