/**
 * UTAK Branch Mapping Configuration
 *
 * Maps UTAK POS branch identifiers to the ledger's branches table.
 *
 * Only branches with `enabled: true` are synced. Others are kept in the config
 * but skipped during sync (can be enabled later by the owner).
 *
 * To add/edit mappings:
 * 1. Find the UTAK branch email in the master account
 * 2. Find the matching branch slug in Settings > Branch Management
 * 3. Update the mapping below and set enabled: true
 *
 * Owner decision (Oct 2026): Only 11 branches should be auto-synced.
 * Note: Greenhills no longer exists and is not included.
 */

export interface UtakBranchMapping {
  /** UTAK branch email (canonical identifier). Null if no UTAK source exists. */
  utakEmail: string | null;
  /** Display name shown on the UTAK card (null if no UTAK source) */
  utakCardName: string | null;
  /** Ledger branch slug (branches.name column) */
  ledgerSlug: string;
  /** Ledger branch label (for display) */
  ledgerLabel: string;
  /** Whether this branch should be auto-synced */
  enabled: boolean;
  /** True if the ledger slug needs verification against the database */
  needsVerification?: boolean;
  /** Optional notes about the mapping */
  notes?: string;
}

/**
 * Complete mapping of UTAK branches to ledger branches.
 *
 * ENABLED BRANCHES (11 per owner decision):
 * - Events, Greenbelt, Lucky China Town, NU MOA, Podium,
 *   SM Bacoor, The Mind Museum, Trinoma, Uptown, WCC, WGC
 *
 * Note: Greenhills no longer exists and is not included.
 * Lucky China Town, NU MOA, SM Bacoor need runtime verification (not in DB seed).
 */
export const UTAK_BRANCH_MAPPINGS: UtakBranchMapping[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // ENABLED BRANCHES (11 total per owner decision)
  // ═══════════════════════════════════════════════════════════════════════════

  // Verified branches (in migrations/seed)
  {
    utakEmail: 'dotcoffee_greenbelt@utak.io',
    utakCardName: 'DOT COFFEE - GREENBELT 3',
    ledgerSlug: 'greenbelt',
    ledgerLabel: 'Greenbelt',
    enabled: true,
  },
  {
    utakEmail: 'dotcoffee_podium@utak.io',
    utakCardName: 'DOT COFFEE - THE PODIUM MALL',
    ledgerSlug: 'podium',
    ledgerLabel: 'Podium',
    enabled: true,
  },
  {
    utakEmail: 'dotcoffee_themindmuseum@utak.io',
    utakCardName: 'DOT COFFEE - THE MIND MUSEUM',
    ledgerSlug: 'mind_museum',
    ledgerLabel: 'The Mind Museum',
    enabled: true,
  },
  {
    utakEmail: 'dotcoffee_landmarktrinoma@utak.io',
    utakCardName: 'DOT COFFEE - LANDMARK TRINOMA',
    ledgerSlug: 'trinoma',
    ledgerLabel: 'Trinoma',
    enabled: true,
  },
  {
    utakEmail: 'dotcoffee_uptownbgc@utak.io',
    utakCardName: 'DOT COFFEE - UPTOWN MALL',
    ledgerSlug: 'uptown',
    ledgerLabel: 'Uptown',
    enabled: true,
  },
  {
    utakEmail: 'dotcoffee_wgc@utak.io',
    utakCardName: 'DOT COFFEE - WGC',
    ledgerSlug: 'wgc',
    ledgerLabel: 'WGC',
    enabled: true,
  },
  {
    utakEmail: 'wcc@utak.io',
    utakCardName: 'DOT COFFEE - W CITY CENTER',
    ledgerSlug: 'wcc',
    ledgerLabel: 'WCC',
    enabled: true,
  },
  {
    utakEmail: 'dotcoffee_events@utaklite.io',
    utakCardName: 'Dot HQ Events',
    ledgerSlug: 'events',
    ledgerLabel: 'Events',
    enabled: true,
  },

  // Branches needing runtime verification (not in DB seed)
  {
    utakEmail: 'dotcoffee_luckychinatownmall@utak.io',
    utakCardName: 'DOT LUCKY CHINATOWN',
    ledgerSlug: 'lucky_chinatown',
    ledgerLabel: 'Lucky China Town',
    enabled: true,
    needsVerification: true,
    notes: 'Slug not in seed data - runtime validation will check if branch exists',
  },
  {
    utakEmail: 'dotcoffee_nationaluniversitymoa@utak.io',
    utakCardName: 'Dot NU MOA',
    ledgerSlug: 'nu_moa',
    ledgerLabel: 'NU MOA',
    enabled: true,
    needsVerification: true,
    notes: 'Slug not in seed data - runtime validation will check if branch exists',
  },
  {
    utakEmail: 'dotcoffee_smbacoor@utak.io',
    utakCardName: 'DOT SM BACOOR',
    ledgerSlug: 'sm_bacoor',
    ledgerLabel: 'SM Bacoor',
    enabled: true,
    needsVerification: true,
    notes: 'Slug not in seed data - runtime validation will check if branch exists',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DISABLED BRANCHES (kept for future use)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    utakEmail: 'dotcoffee_ayalapavillionlaguna@utak.io',
    utakCardName: 'DOT AYALA PAVILION',
    ledgerSlug: 'ayala_pavilion',
    ledgerLabel: 'Ayala Pavilion',
    enabled: false,
    needsVerification: true,
  },
  {
    utakEmail: 'dotcoffee_arcasouth@utak.io',
    utakCardName: 'DOT COFFEE - ARCA SOUTH',
    ledgerSlug: 'arca_south',
    ledgerLabel: 'Arca South',
    enabled: false,
    needsVerification: true,
  },
  {
    utakEmail: 'dotcoffee_falconqc@utak.io',
    utakCardName: 'DOT COFFEE - FALCON HUB',
    ledgerSlug: 'falcon_hub',
    ledgerLabel: 'Falcon Hub',
    enabled: false,
    needsVerification: true,
  },
  {
    utakEmail: 'dotcoffee_ayalamrt@utak.io',
    utakCardName: 'DOT COFFEE - ONE AYALA MRT',
    ledgerSlug: 'one_ayala_mrt',
    ledgerLabel: 'One Ayala MRT',
    enabled: false,
    needsVerification: true,
  },
  {
    utakEmail: 'dotcoffee_smnorthedsa@utak.io',
    utakCardName: 'DOT COFFEE - SM NORTH EDSA',
    ledgerSlug: 'sm_north_edsa',
    ledgerLabel: 'SM North EDSA',
    enabled: false,
    needsVerification: true,
  },
  {
    utakEmail: 'dotcoffee_smstarosa@utak.io',
    utakCardName: 'DOT COFFEE - SM STA ROSA',
    ledgerSlug: 'sm_sta_rosa',
    ledgerLabel: 'SM Sta Rosa',
    enabled: false,
    needsVerification: true,
  },
  {
    utakEmail: 'dotcoffee_southwoods@utak.io',
    utakCardName: 'DOT COFFEE - SOUTHWOODS MALL',
    ledgerSlug: 'southwoods',
    ledgerLabel: 'Southwoods',
    enabled: false,
    needsVerification: true,
  },
  {
    utakEmail: 'dotcoffee_threecentral@utak.io',
    utakCardName: 'DOT COFFEE - THREE CENTRAL',
    ledgerSlug: 'three_central',
    ledgerLabel: 'Three Central',
    enabled: false,
    needsVerification: true,
  },
  {
    utakEmail: 'dotcoffee_eastwood@utak.io',
    utakCardName: 'DOT EASTWOOD 1800',
    ledgerSlug: 'eastwood',
    ledgerLabel: 'Eastwood',
    enabled: false,
    needsVerification: true,
  },
  {
    utakEmail: 'dot_beatiraga@utak.io',
    utakCardName: 'ROB GALLERIA',
    ledgerSlug: 'robinsons_galleria',
    ledgerLabel: 'Robinsons Galleria',
    enabled: false,
    needsVerification: true,
  },
  {
    utakEmail: 'dotcoffee_smmoa@utak.io',
    utakCardName: 'SM MALL OF ASIA (MOA)',
    ledgerSlug: 'sm_moa',
    ledgerLabel: 'SM MOA',
    enabled: false,
    needsVerification: true,
  },
];

/**
 * Get all enabled branch mappings (11 branches per owner decision).
 */
export function getEnabledBranches(): UtakBranchMapping[] {
  return UTAK_BRANCH_MAPPINGS.filter((m) => m.enabled);
}

/**
 * Get all disabled branch mappings (kept for future use).
 */
export function getDisabledBranches(): UtakBranchMapping[] {
  return UTAK_BRANCH_MAPPINGS.filter((m) => !m.enabled);
}

/**
 * Lookup a ledger branch slug by UTAK email.
 * Returns null if the branch is not mapped or disabled.
 */
export function getLedgerSlugByUtakEmail(utakEmail: string): string | null {
  const mapping = UTAK_BRANCH_MAPPINGS.find(
    (m) => m.enabled && m.utakEmail?.toLowerCase() === utakEmail.toLowerCase()
  );
  return mapping?.ledgerSlug ?? null;
}

/**
 * Lookup a ledger branch slug by UTAK card name (fuzzy match).
 * Returns null if the branch is not mapped or disabled.
 */
export function getLedgerSlugByUtakCardName(cardName: string): string | null {
  const normalized = cardName.toLowerCase().trim();
  const mapping = UTAK_BRANCH_MAPPINGS.find(
    (m) => m.enabled && m.utakCardName?.toLowerCase().trim() === normalized
  );
  return mapping?.ledgerSlug ?? null;
}

/**
 * Get all mappings that need verification.
 */
export function getUnverifiedMappings(): UtakBranchMapping[] {
  return UTAK_BRANCH_MAPPINGS.filter((m) => m.enabled && m.needsVerification);
}
