import type { User } from "../types";
import { roles } from "../utils/constants";

export interface RoleFlags {
  isManager: boolean;
  isDeptManager: boolean;
  isSuperAdmin: boolean;
  isGeneralManager: boolean;
}

export function useRoleFlags(user: User | null | undefined): RoleFlags {
  const role = user?.role;
  return {
    isManager: role != null && role >= roles["팀계담당"],
    isDeptManager: role != null && role === roles["부서담당"],
    isSuperAdmin: role != null && role >= roles["교육담당"],
    isGeneralManager: role != null && role >= roles["총괄담당"],
  };
}
