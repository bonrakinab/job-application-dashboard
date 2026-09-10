/**
 * Canonical layout constants for Arnob's uploaded one-page LaTeX reference.
 * Any employer-facing resume change must bump these versions so an older stored
 * pack is visibly stale instead of being mistaken for the current renderer.
 */
export const RESUME_ENGINE_VERSION = 'resume-engine.v12';
export const RESUME_TEMPLATE_VERSION = 'arnob-reference.v12';

export const RESUME_PAGE = {
  width: 595.28,
  height: 841.89,
  // The uploaded reference has visibly narrower text measure than v11. Keeping
  // ~0.47in margins also prevents the dense, edge-to-edge look of the old PDF.
  margin: 34,
  bottom: 18,
} as const;

// v12 starts at the reference proportions and only scales down when the complete
// selected evidence would otherwise overflow. The renderer never drops content.
export const RESUME_LAYOUT_ATTEMPTS = [
  { scale: 1.00, maxExperienceBullets: 3, maxProjects: 3, maxProjectBullets: 1 },
  { scale: 0.97, maxExperienceBullets: 3, maxProjects: 3, maxProjectBullets: 1 },
  { scale: 0.94, maxExperienceBullets: 3, maxProjects: 3, maxProjectBullets: 1 },
  { scale: 0.91, maxExperienceBullets: 3, maxProjects: 3, maxProjectBullets: 1 },
  { scale: 0.88, maxExperienceBullets: 3, maxProjects: 3, maxProjectBullets: 1 },
  { scale: 0.85, maxExperienceBullets: 3, maxProjects: 3, maxProjectBullets: 1 },
] as const;
