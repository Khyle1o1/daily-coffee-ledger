import {
  SelectGroup,
  SelectItem,
  SelectLabel,
} from "@/components/ui/select";
import {
  groupBranchesByCategory,
  type BranchCategory,
} from "@/lib/branchCategory";

export type GroupedBranchOption = {
  value: string;
  label: string;
  category?: BranchCategory;
};

export function GroupedBranchSelectItems({
  options,
}: {
  options: GroupedBranchOption[];
}) {
  return (
    <>
      {groupBranchesByCategory(options).map((group) => (
        <SelectGroup key={group.category}>
          <SelectLabel className="pl-2 text-[11px] uppercase tracking-wider text-muted-foreground">
            {group.label}
          </SelectLabel>
          {group.items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      ))}
    </>
  );
}

export function GroupedBranchOptGroups({
  options,
}: {
  options: GroupedBranchOption[];
}) {
  return (
    <>
      {groupBranchesByCategory(options).map((group) => (
        <optgroup key={group.category} label={group.label}>
          {group.items.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );
}
