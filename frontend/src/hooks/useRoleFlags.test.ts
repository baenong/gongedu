import { describe, expect, it } from "vitest";
import { useRoleFlags } from "./useRoleFlags";
import type { User } from "../types";

function makeUser(role: number): User {
  return {
    id: 1,
    username: "u",
    name: "n",
    department: "d",
    departmentId: 1,
    team: "t",
    teamId: 1,
    role,
  };
}

describe("useRoleFlags", () => {
  it("user가 null이면 모든 flag가 false", () => {
    expect(useRoleFlags(null)).toEqual({
      isManager: false,
      isDeptManager: false,
      isSuperAdmin: false,
      isGeneralManager: false,
    });
  });

  it("일반직원(1)은 모든 flag가 false", () => {
    expect(useRoleFlags(makeUser(1))).toEqual({
      isManager: false,
      isDeptManager: false,
      isSuperAdmin: false,
      isGeneralManager: false,
    });
  });

  it("팀계담당(2)은 isManager만 true", () => {
    expect(useRoleFlags(makeUser(2))).toEqual({
      isManager: true,
      isDeptManager: false,
      isSuperAdmin: false,
      isGeneralManager: false,
    });
  });

  it("부서담당(3)은 isManager, isDeptManager가 true", () => {
    expect(useRoleFlags(makeUser(3))).toEqual({
      isManager: true,
      isDeptManager: true,
      isSuperAdmin: false,
      isGeneralManager: false,
    });
  });

  it("교육담당(4)은 isManager, isSuperAdmin이 true", () => {
    expect(useRoleFlags(makeUser(4))).toEqual({
      isManager: true,
      isDeptManager: false,
      isSuperAdmin: true,
      isGeneralManager: false,
    });
  });

  it("총괄담당(5)은 isDeptManager를 제외한 모든 관리 flag가 true", () => {
    expect(useRoleFlags(makeUser(5))).toEqual({
      isManager: true,
      isDeptManager: false,
      isSuperAdmin: true,
      isGeneralManager: true,
    });
  });

  it("role이 0이어도(값 자체는 존재) falsy 함정 없이 정확히 평가된다", () => {
    expect(useRoleFlags(makeUser(0))).toEqual({
      isManager: false,
      isDeptManager: false,
      isSuperAdmin: false,
      isGeneralManager: false,
    });
  });
});
