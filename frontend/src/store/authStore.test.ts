import { afterEach, describe, expect, it } from "vitest";
import { useAuthStore } from "./authStore";
import type { User } from "../types";

const testUser: User = {
  id: 1,
  username: "tester",
  name: "테스터",
  department: "총무과",
  departmentId: 1,
  team: "인사팀",
  teamId: 1,
  role: 4,
};

describe("useAuthStore", () => {
  afterEach(() => {
    useAuthStore.setState({ user: null, token: null });
  });

  it("초기 상태는 로그인되어 있지 않다", () => {
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().token).toBeNull();
  });

  it("login()을 호출하면 user/token이 저장된다", () => {
    useAuthStore.getState().login(testUser, "test-jwt-token");

    expect(useAuthStore.getState().user).toEqual(testUser);
    expect(useAuthStore.getState().token).toBe("test-jwt-token");
  });

  it("logout()을 호출하면 user/token이 초기화된다", () => {
    useAuthStore.getState().login(testUser, "test-jwt-token");
    useAuthStore.getState().logout();

    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().token).toBeNull();
  });

  it("localStorage(auth-storage)에 로그인 상태가 영속화된다", () => {
    useAuthStore.getState().login(testUser, "test-jwt-token");

    const stored = JSON.parse(localStorage.getItem("auth-storage") ?? "{}");
    expect(stored.state.user).toEqual(testUser);
    expect(stored.state.token).toBe("test-jwt-token");
  });
});
