/**
 * UTAK Branch Mapping Configuration
 *
 * Maps UTAK POS branch identifiers to the ledger's branches table.
 *
 * Each UTAK branch is identified by its card name shown in the master account.
 * The mapping uses the branch email as the canonical key (stable even if card
 * names change), and maps to the ledger branch slug (branches.name column).
 *
 * To add/edit mappings:
 * 1. Find the UTAK branch email in the master account
 * 2. Find the matching branch slug in Settings > Branch Management
 * 3. Update the mapping below
 *
 * Unmapped branches will be flagged during sync but won't block other branches.
 */

export interface UtakBranchMapping {
  /** UTAK branch email (canonical identifier) */
  utakEmail: string;
  /** Display name shown on the UTAK card */
  utakCardName: string;
  /** Ledger branch slug (branches.name column), or null if not yet mapped */
  ledgerSlug: string | null;
  /** Set to true if this mapping is uncertain and needs verification */
  needsVerification?: boolean;
  /** Optional notes about the mapping */
  notes?: string;
}

/**
 * Complete mapping of all 22 UTAK branches to ledger branches.
 *
 * IMPORTANT: The `ledgerSlug` must match exactly the `name` column in the
 * `branches` table, which is typically a lowercase slug like "greenbelt".
 * Check Settings > Branch Management for the correct slugs.
 */
export const UTAK_BRANCH_MAPPINGS: UtakBranchMapping[] = [
  {
    utakEmail: "dotcoffee_greenbelt@utak.io",
    utakCardName: "DOT COFFEE - GREENBELT 3",
    ledgerSlug: "greenbelt",
  },
  {
    utakEmail: "dotcoffee_podium@utak.io",
    utakCardName: "DOT COFFEE - THE PODIUM MALL",
    ledgerSlug: "podium",
  },
  {
    utakEmail: "dotcoffee_themindmuseum@utak.io",
    utakCardName: "DOT COFFEE - THE MIND MUSEUM",
    ledgerSlug: "mind_museum",
  },
  {
    utakEmail: "dotcoffee_landmarktrinoma@utak.io",
    utakCardName: "DOT COFFEE - LANDMARK TRINOMA",
    ledgerSlug: "trinoma",
  },
  {
    utakEmail: "dotcoffee_uptownbgc@utak.io",
    utakCardName: "DOT COFFEE - UPTOWN MALL",
    ledgerSlug: "uptown",
  },
  {
    utakEmail: "dotcoffee_wgc@utak.io",
    utakCardName: "DOT COFFEE - WGC",
    ledgerSlug: "wgc",
  },
  {
    utakEmail: "wcc@utak.io",
    utakCardName: "DOT COFFEE - W CITY CENTER",
    ledgerSlug: "wcc",
  },
  {
    utakEmail: "dotcoffee_events@utaklite.io",
    utakCardName: "Dot HQ Events",
    ledgerSlug: "events",
  },
  {
    utakEmail: "dotcoffee_greenhills@utak.io",
    utakCardName: "DOT COFFEE - GREENHILLS",
    ledgerSlug: "greenhills",
  },
  {
    utakEmail: "dotcoffee_ayalapavillionlaguna@utak.io",
    utakCardName: "DOT AYALA PAVILION",
    ledgerSlug: "ayala_pavilion",
    needsVerification: true,
    notes: "Verify ledger slug matches Settings > Branch Management",
  },
  {
    utakEmail: "dotcoffee_arcasouth@utak.io",
    utakCardName: "DOT COFFEE - ARCA SOUTH",
    ledgerSlug: "arca_south",
    needsVerification: true,
    notes: "Verify ledger slug matches Settings > Branch Management",
  },
  {
    utakEmail: "dotcoffee_falconqc@utak.io",
    utakCardName: "DOT COFFEE - FALCON HUB",
    ledgerSlug: "falcon_hub",
    needsVerification: true,
    notes: "Verify ledger slug matches Settings > Branch Management",
  },
  {
    utakEmail: "dotcoffee_ayalamrt@utak.io",
    utakCardName: "DOT COFFEE - ONE AYALA MRT",
    ledgerSlug: "one_ayala_mrt",
    needsVerification: true,
    notes: "Verify ledger slug matches Settings > Branch Management",
  },
  {
    utakEmail: "dotcoffee_smnorthedsa@utak.io",
    utakCardName: "DOT COFFEE - SM NORTH EDSA",
    ledgerSlug: "sm_north_edsa",
    needsVerification: true,
    notes: "Verify ledger slug matches Settings > Branch Management",
  },
  {
    utakEmail: "dotcoffee_smstarosa@utak.io",
    utakCardName: "DOT COFFEE - SM STA ROSA",
    ledgerSlug: "sm_sta_rosa",
    needsVerification: true,
    notes: "Verify ledger slug matches Settings > Branch Management",
  },
  {
    utakEmail: "dotcoffee_southwoods@utak.io",
    utakCardName: "DOT COFFEE - SOUTHWOODS MALL",
    ledgerSlug: "southwoods",
    needsVerification: true,
    notes: "Verify ledger slug matches Settings > Branch Management",
  },
  {
    utakEmail: "dotcoffee_threecentral@utak.io",
    utakCardName: "DOT COFFEE - THREE CENTRAL",
    ledgerSlug: "three_central",
    needsVerification: true,
    notes: "Verify ledger slug matches Settings > Branch Management",
  },
  {
    utakEmail: "dotcoffee_eastwood@utak.io",
    utakCardName: "DOT EASTWOOD 1800",
    ledgerSlug: "eastwood",
    needsVerification: true,
    notes: "Verify ledger slug matches Settings > Branch Management",
  },
  {
    utakEmail: "dotcoffee_luckychinatownmall@utak.io",
    utakCardName: "DOT LUCKY CHINATOWN",
    ledgerSlug: "lucky_chinatown",
    needsVerification: true,
    notes: "Verify ledger slug matches Settings > Branch Management",
  },
  {
    utakEmail: "dotcoffee_smbacoor@utak.io",
    utakCardName: "DOT SM BACOOR",
    ledgerSlug: "sm_bacoor",
    needsVerification: true,
    notes: "Verify ledger slug matches Settings > Branch Management",
  },
  {
    utakEmail: "dotcoffee_nationaluniversitymoa@utak.io",
    utakCardName: "Dot NU MOA",
    ledgerSlug: "nu_moa",
    needsVerification: true,
    notes: "Verify ledger slug matches Settings > Branch Management",
  },
  {
    utakEmail: "dot_beatiraga@utak.io",
    utakCardName: "ROB GALLERIA",
    ledgerSlug: "robinsons_galleria",
    needsVerification: true,
    notes: "Verify ledger slug matches Settings > Branch Management",
  },
  {
    utakEmail: "dotcoffee_smmoa@utak.io",
    utakCardName: "SM MALL OF ASIA (MOA)",
    ledgerSlug: "sm_moa",
    needsVerification: true,
    notes: "Verify ledger slug matches Settings > Branch Management",
  },
];

/**
 * Lookup a ledger branch slug by UTAK email.
 * Returns null if the branch is not mapped.
 */
export function getLedgerSlugByUtakEmail(utakEmail: string): string | null {
  const mapping = UTAK_BRANCH_MAPPINGS.find(
    (m) => m.utakEmail.toLowerCase() === utakEmail.toLowerCase()
  );
  return mapping?.ledgerSlug ?? null;
}

/**
 * Lookup a ledger branch slug by UTAK card name (fuzzy match).
 * Returns null if the branch is not mapped.
 */
export function getLedgerSlugByUtakCardName(cardName: string): string | null {
  const normalized = cardName.toLowerCase().trim();
  const mapping = UTAK_BRANCH_MAPPINGS.find(
    (m) => m.utakCardName.toLowerCase().trim() === normalized
  );
  return mapping?.ledgerSlug ?? null;
}

/**
 * Get all mappings that need verification.
 */
export function getUnverifiedMappings(): UtakBranchMapping[] {
  return UTAK_BRANCH_MAPPINGS.filter((m) => m.needsVerification);
}

/**
 * Get all mapped branches (with valid ledger slugs).
 */
export function getMappedBranches(): UtakBranchMapping[] {
  return UTAK_BRANCH_MAPPINGS.filter((m) => m.ledgerSlug !== null);
}
