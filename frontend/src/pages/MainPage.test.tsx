import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import MainPage from "./MainPage";
import { useAuthStore } from "../store/authStore";
import type { User, Course, Enrollment } from "../types";

const apiGetMock = vi.fn();

vi.mock("../api/axios", () => ({
  default: {
    get: (...args: unknown[]) => apiGetMock(...args),
    post: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    username: "tester",
    name: "테스터",
    department: "총무과",
    departmentId: 1,
    team: "인사팀",
    teamId: 1,
    role: 1,
    ...overrides,
  };
}

function makeCourse(overrides: Partial<Course> = {}): Course {
  return {
    id: 1,
    year: 2026,
    name: "미제출 과정",
    end_date: "2026-12-31",
    detail: "",
    ...overrides,
  };
}

// 과정/과정별 응답을 넘겨주면 나머지 엔드포인트(부서, 팀 등)는 빈 배열/객체로 처리한다.
function setupApi({
  courses = [] as Course[],
  myEnrollments = [] as Enrollment[],
  departments = [] as unknown[],
  teams = [] as unknown[],
  courseStatus = [] as unknown[],
  myStatus = {} as Record<string, unknown>,
} = {}) {
  apiGetMock.mockImplementation((url: string) => {
    if (url.startsWith("/courses")) return Promise.resolve({ data: courses });
    if (url === "/enrollments/my")
      return Promise.resolve({ data: myEnrollments });
    if (url === "/departments") return Promise.resolve({ data: departments });
    if (url === "/departments/teams") return Promise.resolve({ data: teams });
    if (url.startsWith("/enrollments/course/"))
      return Promise.resolve({ data: courseStatus });
    if (url.startsWith("/enrollments/my/"))
      return Promise.resolve({ data: myStatus });
    return Promise.resolve({ data: {} });
  });
}

describe("MainPage", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    vi.stubGlobal("confirm", vi.fn(() => true));
  });

  afterEach(() => {
    cleanup();
    useAuthStore.setState({ user: null, token: null });
    vi.unstubAllGlobals();
  });

  async function renderAsAndGoToCardsTab(user: User) {
    useAuthStore.setState({ user, token: "t" });
    render(<MainPage />);
    await waitFor(() => expect(apiGetMock).toHaveBeenCalled());
    fireEvent.click(await screen.findByText("📋 교육목록"));
  }

  it("일반직원: 미제출 과정에는 업로드 버튼이, 제출완료 과정에는 다운로드/삭제 버튼이 보인다", async () => {
    const doneCourse = makeCourse({ id: 2, name: "제출완료 과정" });
    setupApi({
      courses: [makeCourse({ id: 1 }), doneCourse],
      myEnrollments: [
        {
          id: 10,
          user_id: 1,
          course_id: 2,
          state: 2,
          file_name: "cert.pdf",
        },
      ],
    });

    await renderAsAndGoToCardsTab(makeUser({ role: 1 }));

    expect(screen.getByText("미제출 과정")).toBeInTheDocument();
    expect(screen.getByText("제출완료 과정")).toBeInTheDocument();
    expect(screen.getByText(/수료증 업로드/)).toBeInTheDocument();
    expect(screen.getByText(/수료증 다운/)).toBeInTheDocument();
    expect(screen.getByText(/수료내역 삭제/)).toBeInTheDocument();
  });

  it("일반직원에게는 '교육과정 등록' 버튼이 보이지 않는다", async () => {
    setupApi({ courses: [makeCourse()] });

    await renderAsAndGoToCardsTab(makeUser({ role: 1 }));

    expect(screen.queryByText("+ 교육과정 등록")).not.toBeInTheDocument();
  });

  it("교육담당에게는 '교육과정 등록' 버튼과 '내가 등록한 교육만 보기' 체크박스가 보인다", async () => {
    setupApi({ courses: [makeCourse({ created_by: 99 })] });

    await renderAsAndGoToCardsTab(makeUser({ id: 1, role: 4 }));

    expect(screen.getByText("+ 교육과정 등록")).toBeInTheDocument();
    expect(screen.getByText("내가 등록한 교육만 보기")).toBeInTheDocument();
  });

  it("'미제출 건만 보기'를 체크하면 이미 제출한 과정은 목록에서 사라진다", async () => {
    setupApi({
      courses: [
        makeCourse({ id: 1, name: "미제출 과정" }),
        makeCourse({ id: 2, name: "제출완료 과정" }),
      ],
      myEnrollments: [
        { id: 10, user_id: 1, course_id: 2, state: 2, file_name: "cert.pdf" },
      ],
    });

    await renderAsAndGoToCardsTab(makeUser({ role: 1 }));

    expect(screen.getByText("제출완료 과정")).toBeInTheDocument();

    fireEvent.click(screen.getByText("미제출 건만 보기"));

    expect(screen.queryByText("제출완료 과정")).not.toBeInTheDocument();
    expect(screen.getByText("미제출 과정")).toBeInTheDocument();
  });

  it("일반직원이 과정을 클릭하면 본인 현황(/enrollments/my/:id)만 조회한다", async () => {
    const course = makeCourse({ id: 7 });
    setupApi({ courses: [course], myStatus: { state: 1 } });

    await renderAsAndGoToCardsTab(makeUser({ id: 1, role: 1 }));

    fireEvent.click(screen.getByText("미제출 과정"));

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith("/enrollments/my/7");
    });
    expect(apiGetMock).not.toHaveBeenCalledWith(
      expect.stringContaining("/enrollments/course/"),
    );
  });

  it("총괄담당이 과정을 클릭하면 전체 현황(/enrollments/course/:id)을 조회한다", async () => {
    const course = makeCourse({ id: 7 });
    setupApi({
      courses: [course],
      courseStatus: [
        {
          user_id: 2,
          name: "홍길동",
          department: "총무과",
          departmentId: 1,
          team: "인사팀",
          teamId: 1,
          enrollment_id: null,
          state: 1,
          submitted_at: null,
          file_name: null,
          stored_file_name: null,
          ai_flagged: null,
          ai_reasoning: null,
          ai_verified: null,
        },
      ],
    });

    await renderAsAndGoToCardsTab(makeUser({ id: 1, role: 5 }));

    fireEvent.click(screen.getByText("미제출 과정"));

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith("/enrollments/course/7");
    });
    expect(await screen.findByText("홍길동")).toBeInTheDocument();
  });

  it("과정이 없으면 안내 문구를 보여준다", async () => {
    setupApi({ courses: [] });

    await renderAsAndGoToCardsTab(makeUser({ role: 1 }));

    expect(screen.getByText("등록된 교육과정이 없습니다.")).toBeInTheDocument();
  });
});
