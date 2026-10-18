import type { CompanyWatch } from './types';

type Fortune500Metadata = {
  rank?: unknown;
  year?: unknown;
  source?: unknown;
  source_url?: unknown;
};

export function fortune500Metadata(company: CompanyWatch): Fortune500Metadata | null {
  const value = company.sourceMetadata?.fortune500;
  return value && typeof value === 'object' ? value as Fortune500Metadata : null;
}

export function fortune500Rank(company: CompanyWatch): number | null {
  const rank = Number(fortune500Metadata(company)?.rank);
  return Number.isFinite(rank) && rank > 0 ? rank : null;
}

export function isFortune500Company(company: CompanyWatch) {
  return fortune500Rank(company) !== null;
}

export function filterFortune500Companies(companies: CompanyWatch[]) {
  return companies
    .filter(isFortune500Company)
    .sort((left, right) => (fortune500Rank(left) ?? Number.MAX_SAFE_INTEGER) - (fortune500Rank(right) ?? Number.MAX_SAFE_INTEGER));
}
