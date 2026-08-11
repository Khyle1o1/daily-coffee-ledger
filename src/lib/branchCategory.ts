export type BranchCategory = "internal" | "external";

/** FR / FR_ / FR- prefix (case-insensitive) marks a franchise / external branch. */
const EXTERNAL_PREFIX = /^\s*fr(\b|[_-\s])/i;

export function getBranchCategory(
  ...parts: Array<string | null | undefined>
): BranchCategory {
  const hit = parts.some((part) => EXTERNAL_PREFIX.test(part ?? ""));
  return hit ? "external" : "internal";
}

export function branchCategoryLabel(category: BranchCategory): string {
  return category === "external" ? "External" : "Internal";
}

export function groupBranchesByCategory<T extends { category?: BranchCategory }>(
  options: T[],
): { category: BranchCategory; label: string; items: T[] }[] {
  const internal = options.filter((item) => (item.category ?? "internal") === "internal");
  const external = options.filter((item) => item.category === "external");
  const groups: { category: BranchCategory; label: string; items: T[] }[] = [];
  if (internal.length) {
    groups.push({ category: "internal", label: "Internal", items: internal });
  }
  if (external.length) {
    groups.push({ category: "external", label: "External", items: external });
  }
  return groups;
}

export function mergeSelectedIds(
  prev: string[],
  ids: string[],
  select: boolean,
): string[] {
  if (select) {
    const next = new Set(prev);
    for (const id of ids) next.add(id);
    return [...next];
  }
  const drop = new Set(ids);
  return prev.filter((id) => !drop.has(id));
}
