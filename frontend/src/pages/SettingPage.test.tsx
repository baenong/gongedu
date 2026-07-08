import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import SettingPage from "./SettingPage";
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

function setupApi({
  departments = [] as Department[],
  teams = [] as Team[],
} = {}) {
  apiGetMock.mockImplementation((url: string) => {
    if (url === "/departments") return Promise.resolve({ data: departments });
    if (url === "/departments/teams")
      return Promise.resolve({ data: teams });
    return Promise.resolve({ data: {} });
  });
}

async function renderAs(role: number) {
  useAuthStore.setState({ user: makeUser(role), token: "t" });
  const utils = render(<SettingPage />);
  await waitFor(() => expect(apiGetMock).toHaveBeenCalledWith("/departments"));
  return utils;
}

describe("SettingPage - AI 검증 설정 섹션 노출", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    apiPutMock.mockReset();
    apiDeleteMock.mockReset();
    setupApi();
    apiPostMock.mockResolvedValue({ data: {} });
    apiDeleteMock.mockResolvedValue({ data: { message: "ok" } });
  });

  afterEach(() => {
    cleanup();
    useAuthStore.setState({ user: null, token: null });
  });

  it("교육담당(4)에게는 AI 검증 설정 섹션이 보이지 않는다", async () => {
    await renderAs(4);

    expect(screen.getByText("부서 정보")).toBeInTheDocument();
    expect(screen.queryByText("AI 수료증 검증 설정")).not.toBeInTheDocument();
  });

  it("총괄담당(5)에게는 AI 검증 설정 섹션이 보인다", async () => {
    await renderAs(5);

    await waitFor(() => {
      expect(screen.getByText("AI 수료증 검증 설정")).toBeInTheDocument();
    });
  });
});

describe("SettingPage - 부서 관리", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    apiPutMock.mockReset();
    apiDeleteMock.mockReset();
    apiPostMock.mockResolvedValue({ data: { id: 10 } });
    apiDeleteMock.mockResolvedValue({ data: { message: "ok" } });
    vi.stubGlobal("confirm", vi.fn(() => true));
  });

  afterEach(() => {
    cleanup();
    useAuthStore.setState({ user: null, token: null });
  });

  function deptSection() {
    return screen.getByText("부서 정보").closest("section") as HTMLElement;
  }

  it("부서명/인덱스를 입력하고 추가를 누르면 부서 등록 API가 호출되고 목록에 반영된다", async () => {
    setupApi({ departments: [] });
    await renderAs(5);

    const section = deptSection();
    const [deptNameInput] = within(section).getAllByRole("textbox");
    const [deptIdxInput] = within(section).getAllByRole("spinbutton");

    fireEvent.change(deptNameInput, { target: { value: "총무과" } });
    fireEvent.change(deptIdxInput, { target: { value: "1" } });
    fireEvent.click(within(section).getAllByText("✏️ 추가")[0]);

    await waitFor(() =>
      expect(apiPostMock).toHaveBeenCalledWith("/departments", {
        name: "총무과",
        orderIndex: 1,
      }),
    );
    expect(await within(section).findByText("총무과")).toBeInTheDocument();
  });

  it("부서명을 입력하지 않고 추가를 누르면 API가 호출되지 않는다", async () => {
    setupApi({ departments: [] });
    await renderAs(5);

    const section = deptSection();
    fireEvent.click(within(section).getAllByText("✏️ 추가")[0]);

    expect(apiPostMock).not.toHaveBeenCalled();
  });

  it("부서를 선택하면 추가 버튼이 편집 버튼으로 바뀐다", async () => {
    setupApi({
      departments: [{ id: 1, name: "총무과", orderIndex: 1 }],
    });
    await renderAs(5);

    const section = deptSection();
    fireEvent.click(await within(section).findByText("총무과"));

    expect(within(section).getByText("✏️ 편집")).toBeInTheDocument();
    // 팀 쪽 "추가" 버튼은 그대로 남아있으므로 부서용 추가 버튼만 사라졌는지 개수로 확인
    expect(within(section).getAllByText("✏️ 추가")).toHaveLength(1);
  });

  it("부서 삭제 시 확인 후 삭제 API를 호출하고 목록에서 제거한다", async () => {
    setupApi({
      departments: [{ id: 1, name: "총무과", orderIndex: 1 }],
    });
    await renderAs(5);

    const section = deptSection();
    fireEvent.click(await within(section).findByText("총무과"));
    fireEvent.click(within(section).getAllByText("🗑️ 삭제")[0]);

    await waitFor(() =>
      expect(apiDeleteMock).toHaveBeenCalledWith("/departments/1"),
    );
    expect(within(section).queryByText("총무과")).not.toBeInTheDocument();
  });
});

describe("SettingPage - 팀/계 관리", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    apiPutMock.mockReset();
    apiDeleteMock.mockReset();
    apiPostMock.mockResolvedValue({ data: { id: 20 } });
    vi.stubGlobal("confirm", vi.fn(() => true));
  });

  afterEach(() => {
    cleanup();
    useAuthStore.setState({ user: null, token: null });
  });

  it("부서를 선택한 뒤 팀을 추가하면 선택된 부서 소속으로 등록된다", async () => {
    setupApi({
      departments: [{ id: 1, name: "총무과", orderIndex: 1 }],
      teams: [],
    });
    await renderAs(5);

    const section = screen.getByText("부서 정보").closest("section") as HTMLElement;
    fireEvent.click(await within(section).findByText("총무과"));

    const [, teamNameInput] = within(section).getAllByRole("textbox");
    const [, teamIdxInput] = within(section).getAllByRole("spinbutton");
    fireEvent.change(teamNameInput, { target: { value: "인사계" } });
    fireEvent.change(teamIdxInput, { target: { value: "1" } });
    fireEvent.click(within(section).getByText("✏️ 추가"));

    await waitFor(() =>
      expect(apiPostMock).toHaveBeenCalledWith("/departments/teams", {
        name: "인사계",
        orderIndex: 1,
        departmentId: 1,
      }),
    );
    expect(await within(section).findByText("인사계")).toBeInTheDocument();
  });
});

describe("SettingPage - AI 검증 설정 저장", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    apiPutMock.mockReset();
    apiDeleteMock.mockReset();
    setupApi();
    apiPostMock.mockResolvedValue({ data: {} });
  });

  afterEach(() => {
    cleanup();
    useAuthStore.setState({ user: null, token: null });
  });

  it("API 키와 모델을 입력해 저장하면 입력값 그대로 저장 요청을 보낸다", async () => {
    await renderAs(5);

    const section = screen
      .getByText("AI 수료증 검증 설정")
      .closest("section") as HTMLElement;

    const apiKeyInput = section.querySelector(
      'input[type="password"]',
    ) as HTMLInputElement;
    fireEvent.change(apiKeyInput, { target: { value: "sk-test-key" } });

    const modelInput = within(section).getByPlaceholderText(
      "예: gpt-4o (비우면 기본값 사용)",
    );
    fireEvent.change(modelInput, { target: { value: "gpt-4o-mini" } });

    fireEvent.click(within(section).getByText("저장"));

    await waitFor(() =>
      expect(apiPostMock).toHaveBeenCalledWith("/settings/ai", {
        provider: "openai",
        openaiModel: "gpt-4o-mini",
        anthropicModel: "",
        openaiApiKey: "sk-test-key",
        anthropicApiKey: "",
      }),
    );
  });

  it("저장 후 API 키 입력란이 비워진다", async () => {
    await renderAs(5);

    const section = screen
      .getByText("AI 수료증 검증 설정")
      .closest("section") as HTMLElement;

    const apiKeyInput = section.querySelector(
      'input[type="password"]',
    ) as HTMLInputElement;
    fireEvent.change(apiKeyInput, { target: { value: "sk-test-key" } });
    fireEvent.click(within(section).getByText("저장"));

    await waitFor(() => expect(apiKeyInput.value).toBe(""));
  });
});

describe("SettingPage - 데이터 정리", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    apiPutMock.mockReset();
    apiDeleteMock.mockReset();
    setupApi();
    apiDeleteMock.mockResolvedValue({ data: { message: "정리되었습니다." } });
  });

  afterEach(() => {
    cleanup();
    useAuthStore.setState({ user: null, token: null });
  });

  it("실행하기를 누르면 확인 후 연도/모드와 함께 cleanup API를 호출한다", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    await renderAs(5);

    fireEvent.click(screen.getByText("실행하기"));

    await waitFor(() =>
      expect(apiDeleteMock).toHaveBeenCalledWith("/settings/cleanup", {
        data: {
          year: new Date().getFullYear() - 1,
          mode: "files_only",
        },
      }),
    );
  });

  it("확인 대화상자를 취소하면 cleanup API가 호출되지 않는다", async () => {
    vi.stubGlobal("confirm", vi.fn(() => false));
    await renderAs(5);

    fireEvent.click(screen.getByText("실행하기"));

    expect(apiDeleteMock).not.toHaveBeenCalled();
  });
});

describe("SettingPage - 조직 초기화", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    apiPutMock.mockReset();
    apiDeleteMock.mockReset();
    setupApi();
    apiDeleteMock.mockResolvedValue({ data: { message: "초기화되었습니다." } });
    vi.stubGlobal("confirm", vi.fn(() => true));
  });

  afterEach(() => {
    cleanup();
    useAuthStore.setState({ user: null, token: null });
  });

  it("팀/계 초기화 버튼 클릭 시 확인 후 초기화 API를 호출한다", async () => {
    await renderAs(5);

    fireEvent.click(screen.getByRole("button", { name: "팀/계 초기화" }));

    await waitFor(() =>
      expect(apiDeleteMock).toHaveBeenCalledWith("/departments/teams/reset"),
    );
  });

  it("부서·팀 전체 초기화 버튼 클릭 시 확인 후 초기화 API를 호출한다", async () => {
    await renderAs(5);

    fireEvent.click(screen.getByRole("button", { name: "부서·팀 전체 초기화" }));

    await waitFor(() =>
      expect(apiDeleteMock).toHaveBeenCalledWith("/departments/reset"),
    );
  });
});
