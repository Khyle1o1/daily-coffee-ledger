import type { BranchCategory } from "@/lib/branchCategory";

export type Branch = {
  id: string;
  code: string;
  name: string;
  address: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  category: BranchCategory;
};

