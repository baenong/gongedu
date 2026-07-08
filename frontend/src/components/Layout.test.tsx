import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Layout from "./Layout";
import { useAuthStore } from "../store/authStore";
import type { User } from "../types";

function makeUser(role: number): User {
  return {
    id: 1,
    username: "tester",
    name: "테스터",
    department: "총무과",
    departmentId: 1,
    team: "인사팀",
    teamId: 1,
    role,
  };
}

function renderLayout(role: number) {
  useAuthStore.setState({ user: makeUser(role), token: "t" });

  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<div>본문</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("Layout 상단 관리자 메뉴 노출", () => {
  afterEach(() => {
    cleanup();
    useAuthStore.setState({ user: null, token: null });
  });

  it("일반직원(1)에게는 직원관리/설정/기능개선 의견 링크가 보이지 않는다", () => {
    renderLayout(1);

    expect(screen.queryByText("직원관리")).not.toBeInTheDocument();
    expect(screen.queryByText("설정")).not.toBeInTheDocument();
    expect(screen.queryByText("기능개선 의견")).not.toBeInTheDocument();
  });

  it("부서담당(3)에게도 아직 관리자 메뉴가 보이지 않는다", () => {
    renderLayout(3);

    expect(screen.queryByText("직원관리")).not.toBeInTheDocument();
    expect(screen.queryByText("설정")).not.toBeInTheDocument();
    expect(screen.queryByText("기능개선 의견")).not.toBeInTheDocument();
  });

  it("교육담당(4)에게는 직원관리만 보이고 설정/기능개선 의견은 안 보인다", () => {
    renderLayout(4);

    expect(screen.getByText("직원관리")).toBeInTheDocument();
    expect(screen.queryByText("설정")).not.toBeInTheDocument();
    expect(screen.queryByText("기능개선 의견")).not.toBeInTheDocument();
  });

  it("총괄담당(5)에게는 직원관리/설정/기능개선 의견이 모두 보인다", () => {
    renderLayout(5);

    expect(screen.getByText("직원관리")).toBeInTheDocument();
    expect(screen.getByText("설정")).toBeInTheDocument();
    expect(screen.getByText("기능개선 의견")).toBeInTheDocument();
  });

  it("시스템관리자(6)에게도 모두 보인다", () => {
    renderLayout(6);

    expect(screen.getByText("직원관리")).toBeInTheDocument();
    expect(screen.getByText("설정")).toBeInTheDocument();
    expect(screen.getByText("기능개선 의견")).toBeInTheDocument();
  });
});
