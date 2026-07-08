import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import { useAuthStore } from "../store/authStore";
import type { User } from "../types";

function renderProtected(
  props: { requireAdmin?: boolean; minRole?: number },
  initialPath = "/protected",
) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<div>로그인 페이지</div>} />
        <Route path="/" element={<div>홈 페이지</div>} />
        <Route element={<ProtectedRoute {...props} />}>
          <Route path="/protected" element={<div>보호된 내용</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

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

describe("ProtectedRoute", () => {
  afterEach(() => {
    cleanup();
    useAuthStore.setState({ user: null, token: null });
  });

  it("로그인하지 않았으면 /login으로 리다이렉트한다", () => {
    renderProtected({});

    expect(screen.getByText("로그인 페이지")).toBeInTheDocument();
  });

  it("로그인했으면 권한 요구가 없는 라우트를 통과시킨다", () => {
    useAuthStore.setState({ user: makeUser(1), token: "t" });

    renderProtected({});

    expect(screen.getByText("보호된 내용")).toBeInTheDocument();
  });

  it("requireAdmin인데 기본 기준(교육담당=4) 미달이면 홈으로 리다이렉트한다", () => {
    useAuthStore.setState({ user: makeUser(3), token: "t" }); // 부서담당

    renderProtected({ requireAdmin: true });

    expect(screen.getByText("홈 페이지")).toBeInTheDocument();
  });

  it("requireAdmin이고 기본 기준을 만족하면 통과시킨다", () => {
    useAuthStore.setState({ user: makeUser(4), token: "t" }); // 교육담당

    renderProtected({ requireAdmin: true });

    expect(screen.getByText("보호된 내용")).toBeInTheDocument();
  });

  it("minRole이 지정되면 기본 기준 대신 그 값을 사용한다", () => {
    useAuthStore.setState({ user: makeUser(4), token: "t" }); // 교육담당

    renderProtected({ requireAdmin: true, minRole: 5 }); // 총괄담당 이상 요구

    expect(screen.getByText("홈 페이지")).toBeInTheDocument();
  });

  it("minRole을 만족하면 통과시킨다", () => {
    useAuthStore.setState({ user: makeUser(5), token: "t" }); // 총괄담당

    renderProtected({ requireAdmin: true, minRole: 5 });

    expect(screen.getByText("보호된 내용")).toBeInTheDocument();
  });
});
