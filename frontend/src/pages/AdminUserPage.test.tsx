import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import AdminUserPage from "./AdminUserPage";
import { useAuthStore } from "../store/authStore";
import type { User, Department, Team } from "../types";

const apiGetMock = vi.fn();
const apiPostMock = vi.fn();
const apiPutMock = vi.fn();
const apiDeleteMock = vi.fn();

vi.mock("../api/axios", () => ({
  default: {
    get: (...args: unknown[]) => apiGetMock(...args),
    post: (...args: unknown[]) => apiPostMock(...args),
    put: (...args: unknown[]) => apiPutMock(...args),
    delete: (...args: unknown[]) => apiDeleteMock(...args),
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

// 사용자 목록/부서/팀 응답을 넘겨주면 나머지 엔드포인트는 빈 값으로 처리한다.
function setupApi({
  users = [] as User[],
  departments = [] as Department[],
  teams = [] as Team[],
  userStatus = [] as unknown[],
} = {}) {
  apiGetMock.mockImplementation((url: string) => {
    if (url === "/users") return Promise.resolve({ data: users });
    if (url === "/departments") return Promise.resolve({ data: departments });
    if (url === "/departments/teams") return Promise.resolve({ data: teams });
    if (url.startsWith("/enrollments/status/user/"))
      return Promise.resolve({ data: userStatus });
    return Promise.resolve({ data: {} });
  });
}

describe("AdminUserPage", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    apiPutMock.mockReset();
    apiDeleteMock.mockReset();
    apiPostMock.mockResolvedValue({ data: { message: "ok" } });
    apiPutMock.mockResolvedValue({ data: { message: "ok" } });
    apiDeleteMock.mockResolvedValue({ data: { message: "ok" } });
    vi.stubGlobal("confirm", vi.fn(() => true));
  });

  afterEach(() => {
    cleanup();
    useAuthStore.setState({ user: null, token: null });
    vi.unstubAllGlobals();
  });

  async function renderAs(user: User) {
    useAuthStore.setState({ user, token: "t" });
    render(<AdminUserPage />);
    await waitFor(() => expect(apiGetMock).toHaveBeenCalledWith("/users"));
  }

  it("마운트 시 사용자/부서/팀 목록을 불러와 렌더링한다", async () => {
    setupApi({ users: [makeUser({ name: "홍길동" })] });

    await renderAs(makeUser({ role: 5 }));

    expect(await screen.findByText("홍길동")).toBeInTheDocument();
    expect(apiGetMock).toHaveBeenCalledWith("/departments");
    expect(apiGetMock).toHaveBeenCalledWith("/departments/teams");
  });

  it("총괄담당 미만은 사용자 등록/초기화 등 관리 버튼이 보이지 않는다", async () => {
    setupApi({ users: [makeUser({ id: 2, name: "김철수", role: 1 })] });

    await renderAs(makeUser({ role: 4 })); // 교육담당

    expect(screen.queryByText("🪪 사용자 등록")).not.toBeInTheDocument();
    expect(screen.queryByText("🗑️ 초기화")).not.toBeInTheDocument();
  });

  it("총괄담당 이상에게는 사용자 등록/초기화 버튼이 보인다", async () => {
    setupApi({ users: [] });

    await renderAs(makeUser({ role: 5 }));

    expect(screen.getByText("🪪 사용자 등록")).toBeInTheDocument();
    expect(screen.getByText("🗑️ 초기화")).toBeInTheDocument();
  });

  it("이름/ID로 검색하면 일치하지 않는 사용자는 목록에서 사라진다", async () => {
    setupApi({
      users: [
        makeUser({ id: 1, name: "홍길동", username: "hong" }),
        makeUser({ id: 2, name: "김철수", username: "kim" }),
      ],
    });

    await renderAs(makeUser({ role: 5 }));

    expect(await screen.findByText("홍길동")).toBeInTheDocument();
    expect(screen.getByText("김철수")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("성명 또는 ID 검색"), {
      target: { value: "홍길동" },
    });

    expect(screen.getByText("홍길동")).toBeInTheDocument();
    expect(screen.queryByText("김철수")).not.toBeInTheDocument();
  });

  it("시스템관리자가 아닌 조회자에게는 시스템관리자 계정이 노출되지 않는다", async () => {
    setupApi({
      users: [
        makeUser({ id: 2, name: "일반관리자", role: 5 }),
        makeUser({ id: 3, name: "최고관리자", role: 6 }),
      ],
    });

    await renderAs(makeUser({ id: 1, role: 5 })); // 총괄담당(시스템관리자 아님)

    expect(await screen.findByText("일반관리자")).toBeInTheDocument();
    expect(screen.queryByText("최고관리자")).not.toBeInTheDocument();
  });

  it("동급 이상 권한의 사용자에게는 수정/삭제 버튼이 보이지 않는다", async () => {
    setupApi({
      users: [
        makeUser({ id: 2, name: "동급관리자", role: 5 }),
        makeUser({ id: 3, name: "하위직원", role: 1 }),
      ],
    });

    await renderAs(makeUser({ id: 1, role: 5 }));

    const sameLevelRow = (
      await screen.findByText("동급관리자")
    ).closest("tr") as HTMLElement;
    expect(within(sameLevelRow).queryByText("수정")).not.toBeInTheDocument();

    const lowerRow = screen.getByText("하위직원").closest("tr") as HTMLElement;
    expect(within(lowerRow).getByText("수정")).toBeInTheDocument();
    expect(within(lowerRow).getByText("삭제")).toBeInTheDocument();
  });

  it("필수 항목을 입력하지 않고 등록하면 API가 호출되지 않는다", async () => {
    setupApi({ users: [] });
    await renderAs(makeUser({ role: 5 }));

    fireEvent.click(screen.getByText("🪪 사용자 등록"));
    const modal = screen.getByText("새 사용자 등록").closest("div") as HTMLElement;
    fireEvent.click(within(modal).getByText("등록하기"));

    expect(apiPostMock).not.toHaveBeenCalled();
  });

  it("필수 항목을 입력하면 사용자가 등록되고 목록이 갱신된다", async () => {
    setupApi({ users: [] });
    await renderAs(makeUser({ role: 5 }));

    fireEvent.click(screen.getByText("🪪 사용자 등록"));
    const modal = screen.getByText("새 사용자 등록").closest("div") as HTMLElement;

    const [usernameInput, nameInput] = within(modal).getAllByRole("textbox");
    fireEvent.change(usernameInput, { target: { value: "newuser" } });
    fireEvent.change(nameInput, { target: { value: "새직원" } });
    const passwordInput = modal.querySelector(
      'input[type="password"]',
    ) as HTMLInputElement;
    fireEvent.change(passwordInput, { target: { value: "1234" } });

    fireEvent.click(within(modal).getByText("등록하기"));

    await waitFor(() =>
      expect(apiPostMock).toHaveBeenCalledWith(
        "/users",
        expect.objectContaining({
          username: "newuser",
          name: "새직원",
          password: "1234",
        }),
      ),
    );
    // 등록 후 목록을 다시 불러온다
    expect(apiGetMock).toHaveBeenCalledWith("/users");
  });

  it("삭제 버튼 클릭 시 확인 후 삭제 API를 호출한다", async () => {
    setupApi({ users: [makeUser({ id: 9, name: "삭제대상", role: 1 })] });
    await renderAs(makeUser({ role: 5 }));

    const row = (await screen.findByText("삭제대상")).closest("tr") as HTMLElement;
    fireEvent.click(within(row).getByText("삭제"));

    await waitFor(() => expect(apiDeleteMock).toHaveBeenCalledWith("/users/9"));
  });

  it("초기화 버튼 클릭 시 확인 후 초기화 API를 호출한다", async () => {
    setupApi({ users: [] });
    await renderAs(makeUser({ role: 5 }));

    fireEvent.click(screen.getByText("🗑️ 초기화"));

    await waitFor(() =>
      expect(apiDeleteMock).toHaveBeenCalledWith("/users/reset"),
    );
  });

  it("행을 클릭하면 해당 사용자의 이수 현황을 조회한다", async () => {
    setupApi({
      users: [makeUser({ id: 4, name: "조회대상", role: 1 })],
      userStatus: [
        {
          course_id: 1,
          course_name: "테스트 과정",
          end_date: "2026-01-01",
          state: 2,
          submitted_at: "2026-01-01",
          file_name: "cert.pdf",
        },
      ],
    });
    await renderAs(makeUser({ role: 5 }));

    fireEvent.click(await screen.findByText("조회대상"));

    await waitFor(() =>
      expect(apiGetMock).toHaveBeenCalledWith(
        expect.stringContaining("/enrollments/status/user/4"),
      ),
    );
    expect(await screen.findByText("테스트 과정")).toBeInTheDocument();
  });
});
