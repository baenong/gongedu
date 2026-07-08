import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import SettingPage from "./SettingPage";
import { useAuthStore } from "../store/authStore";
import type { User } from "../types";

vi.mock("../api/axios", () => ({
  default: {
    get: vi.fn((url: string) => {
      if (url === "/departments" || url === "/departments/teams") {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: {} });
    }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

// jsdom에는 ResizeObserver가 없어 ScrollFade(내부에서 사용)가 렌더링 시 죽는다.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);

function makeUser(role: number): User {
  return {
    id: 1,
    username: "tester",
    name: "테스터",
    department: "",
    departmentId: 0,
    team: "",
    teamId: 0,
    role,
  };
}

function renderAs(role: number) {
  useAuthStore.setState({ user: makeUser(role), token: "t" });
  return render(<SettingPage />);
}

describe("SettingPage - AI 검증 설정 섹션 노출", () => {
  afterEach(() => {
    cleanup();
    useAuthStore.setState({ user: null, token: null });
  });

  it("교육담당(4)에게는 AI 검증 설정 섹션이 보이지 않는다", async () => {
    renderAs(4);

    await waitFor(() => {
      expect(screen.getByText("부서 정보")).toBeInTheDocument();
    });
    expect(screen.queryByText("AI 수료증 검증 설정")).not.toBeInTheDocument();
  });

  it("총괄담당(5)에게는 AI 검증 설정 섹션이 보인다", async () => {
    renderAs(5);

    await waitFor(() => {
      expect(screen.getByText("AI 수료증 검증 설정")).toBeInTheDocument();
    });
  });
});
