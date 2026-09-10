/**
 * Canonical layout constants for Arnob's uploaded one-page LaTeX resume reference.
 * Any visual change bumps this version so previously generated packs are stale.
 */
export const RESUME_TEMPLATE_VERSION = 'arnob-computer-modern-reference.v13';

export const RESUME_PAGE = {
  width: 595.28,
  height: 841.89,
  // Measured from the supplied A4 LaTeX reference PDF.
  margin: 33.84,
  bottom: 18,
} as const;

/**
 * Never shrink the font to make a crowded resume fit. The reference uses one
 * consistent typographic scale; when content is too dense, reduce lower-value
 * evidence instead. Pack skills are already JD-ranked, so trimming their tail
 * is preferable to making the entire Skills / Projects half visibly smaller.
 */
export const RESUME_LAYOUT_ATTEMPTS = [
  { scale: 1.00, maxExperienceBullets: 3, maxProjects: 3, maxProjectBullets: 1, maxSkills: 30 },
  { scale: 1.00, maxExperienceBullets: 2, maxProjects: 3, maxProjectBullets: 1, maxSkills: 28 },
  { scale: 1.00, maxExperienceBullets: 2, maxProjects: 2, maxProjectBullets: 1, maxSkills: 24 },
  { scale: 1.00, maxExperienceBullets: 1, maxProjects: 2, maxProjectBullets: 1, maxSkills: 20 },
] as const;
