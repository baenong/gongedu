import { useEffect, useMemo, useState, useRef } from "react";
import api from "../api/axios";
import axios from "axios";
import { getErrorMessage } from "../utils/errorUtils";
import { downloadBlob } from "../utils/downloadFile";
import { buildCsvBlob } from "../utils/csv";
import type { Department, SelectOption, Team, User } from "../types";
import { useAuthStore } from "../store/authStore";
import { useRoleFlags } from "../hooks/useRoleFlags";
import Select from "../components/Select";
import TableHeader from "../components/TableHeader";
import TableRow from "../components/TableRow";
import toast from "react-hot-toast";
import ActionButton from "../components/ActionButton";
import { roles, ROLE_META, getRoleLabel } from "../utils/constants";
import UserCreateModal from "../components/UserCreateModal";
import UserEditModal from "../components/UserEditModal";
import UserStatusModal from "../components/UserStatusModal";

const ROLE_ALL = "all";

const AdminUserPage = () => {
  const currentUser = useAuthStore((state) => state.user);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 조직 및 팀
  const [allTeams, setAllTeams] = useState<Team[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileEditRef = useRef<HTMLInputElement>(null);

  // 모달 및 폼 상태
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    username: "",
    password: "",
    name: "",
    department: "",
    departmentId: 0,
    team: "",
    teamId: 0,
    role: 1,
  });

  // 수정 모달 상태
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    id: 0,
    username: "", // 보여주기용 (수정불가)
    name: "", // 보여주기용 (수정불가)
    department: "",
    departmentId: 0,
    team: "",
    teamId: 0,
    password: "", // 선택사항
    role: 1,
  });

  // 이수 현황 모달 상태
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedUserName, setSelectedUserName] = useState("");

  // 필터링 관련
  const [filterName, setFilterName] = useState("");
  const [filterTeam, setFilterTeam] = useState(-1);
  const [filterDepartment, setFilterDepartment] = useState(-1);
  const [filterRole, setFilterRole] = useState(ROLE_ALL);
  const [teamOptions, setTeamOptions] = useState<SelectOption[]>([
    { label: "모든 팀(계)", value: -1 },
  ]);
  const [departmentOptions, setDepartmentOptions] = useState<SelectOption[]>([
    { label: "모든 부서", value: -1 },
  ]);

  const { isGeneralManager: canManageUsers } = useRoleFlags(currentUser);

  // 등록/수정 폼의 부서 선택은 "미지정"은 있어도 "모든 부서"라는 실제 배정 값은
  // 있을 수 없으므로, 목록 필터용 옵션에서 "모든 부서"(value: -1) 항목만 제외한다.
  const assignableDepartmentOptions = useMemo(
    () => departmentOptions.filter((d) => d.value !== -1),
    [departmentOptions],
  );

  const filteredUsers = users.filter((user) => {
    const matchName =
      filterName.trim() === "" ||
      user.name.includes(filterName.trim()) ||
      user.username.includes(filterName.trim());
    const matchTeam = filterTeam === -1 || user.teamId === filterTeam;

    const matchDepartment =
      filterDepartment === -1 || user.departmentId === filterDepartment;

    const isNotAdmin =
      currentUser?.role === roles["시스템관리자"]
        ? true
        : user.role < roles["시스템관리자"];

    const matchRole =
      isNotAdmin &&
      (filterRole === ROLE_ALL || user.role === Number(filterRole));
    return matchName && matchTeam && matchDepartment && matchRole;
  });

  const handleTeams = (deptId: number) => {
    const tempTeams =
      deptId === -1
        ? allTeams
        : allTeams.filter((team) => team.departmentId === deptId);
    setTeamOptions([
      { label: "모든 팀(계)", value: -1 },
      ...tempTeams.map((team) => ({ label: team.name, value: team.id })),
    ]);
  };

  const assignableRoleMeta = Object.entries(ROLE_META).filter(
    ([value]) => Number(value) !== roles["시스템관리자"],
  );

  let roleOptions = [
    { value: ROLE_ALL, label: "모든 권한" },
    ...assignableRoleMeta.map(([value, meta]) => ({
      value,
      label: `${meta.icon} ${meta.label}`,
    })),
  ];

  if (currentUser && currentUser.role === roles["시스템관리자"]) {
    const adminMeta = ROLE_META[roles["시스템관리자"]];
    roleOptions = [
      ...roleOptions,
      {
        value: String(roles["시스템관리자"]),
        label: `${adminMeta.icon} ${adminMeta.label}`,
      },
    ];
  }

  // 시스템관리자 role은 UI에서 직접 부여할 수 없어 등록/수정 옵션에서 제외한다.
  const editRoleOptions = assignableRoleMeta.map(([value, meta]) => ({
    value: Number(value),
    label: `${meta.icon} ${meta.label}`,
  }));

  // 사용자 목록 불러오기
  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const response = await api.get("/users");
      setUsers(response.data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        toast.error("사용자 목록을 불러오지 못했습니다.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fetchData = async () => {
    setIsLoading(true);

    try {
      const [resDept, resTeam] = await Promise.all([
        api.get("/departments"),
        api.get("/departments/teams"),
      ]);
      const dataDept = resDept.data;
      setDepartmentOptions([
        { label: "모든 부서", value: -1 },
        ...dataDept.map((dept: Department) => ({
          label: dept.name,
          value: dept.id,
        })),
      ]);

      const dataTeam = resTeam.data;
      setAllTeams(dataTeam);
      setTeamOptions([{ label: "모든 팀(계)", value: -1 }]);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        toast.error("부서 정보를 불러오지 못했습니다.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchData();
  }, []);

  const handleResetUsers = async () => {
    if (
      !window.confirm(
        "⚠️ 경고: [일반직원]과 [팀계담당] 데이터가 모두 삭제됩니다.\n이미 제출된 수료증 파일도 함께 삭제될 수 있습니다.\n정말 초기화하시겠습니까?",
      )
    )
      return;

    const toastId = toast.loading("초기화 중...");
    try {
      const res = await api.delete("/users/reset");
      toast.success(res.data.message, { id: toastId });
      fetchUsers();
    } catch (error) {
      toast.error(getErrorMessage(error, "초기화 실패"), { id: toastId });
    }
  };

  const handleDownloadUsersCSV = () => {
    if (filteredUsers.length === 0) {
      toast.error("다운로드할 사용자가 없습니다.");
      return;
    }

    const headers = ["id", "name", "department", "team"];
    const rows = filteredUsers.map((u) => [
      u.username,
      u.name,
      u.department,
      u.team,
    ]);
    downloadBlob(buildCsvBlob(headers, rows), "직원목록.csv");
  };

  const handleDownloadTemplate = () => {
    // 엑셀에서 한글 깨짐 방지를 위해 BOM(\uFEFF) 추가
    const csvContent =
      "\uFEFFid,name,department,team\nA0000000,홍길동,총무과,총무계\nB0000000,김철수,총무과,인사계";
    downloadBlob(
      new Blob([csvContent], { type: "text/csv;charset=utf-8;" }),
      "직원등록_양식.csv",
    );
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm(`${file.name} 파일을 업로드하여 일괄 등록하시겠습니까?`)) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    const toastId = toast.loading("엑셀 데이터를 처리 중입니다...");

    try {
      const res = await api.post("/users/upload-excel", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success(res.data.message, { id: toastId, duration: 4000 });
      fetchUsers();
    } catch (error) {
      toast.error(getErrorMessage(error, "업로드 실패"), { id: toastId });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleEditExcelUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm(`${file.name} 파일을 업로드하여 일괄 변경하시겠습니까?`)) {
      if (fileEditRef.current) fileEditRef.current.value = "";
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    const toastId = toast.loading("엑셀 데이터를 처리 중입니다...");

    try {
      const res = await api.post("/users/upload-edit-excel", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success(res.data.message, { id: toastId, duration: 4000 });
      fetchUsers();
    } catch (error) {
      toast.error(getErrorMessage(error, "업로드 실패"), { id: toastId });
    } finally {
      if (fileEditRef.current) fileEditRef.current.value = "";
    }
  };

  const openStatusModal = (userId: number, userName: string) => {
    setSelectedUserId(userId);
    setSelectedUserName(userName);
    setShowStatusModal(true);
  };

  // 사용자 등록 핸들러
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.username || !createForm.password || !createForm.name) {
      toast.error("모든 필드를 입력해주세요.");
      return;
    }

    try {
      await api.post("/users", createForm);
      toast.success("사용자가 등록되었습니다.");
      setShowCreateModal(false);
      setCreateForm({
        username: "",
        password: "",
        name: "",
        department: "",
        departmentId: 0,
        team: "",
        teamId: 0,
        role: 1,
      }); // 초기화
      fetchUsers(); // 목록 갱신
    } catch (error) {
      toast.error(getErrorMessage(error, "등록 중 오류가 발생했습니다."));
    }
  };

  // 수정 모달
  const openEditModal = (user: User) => {
    setEditForm({
      id: user.id,
      username: user.username,
      name: user.name,
      password: "", // 비워둠 (입력 안하면 변경 안 함)
      department: user.department,
      departmentId: user.departmentId,
      team: user.team,
      teamId: user.teamId,
      role: user.role,
    });
    setShowEditModal(true);
  };

  // 정보 업데이트 핸들러
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.put(`/users/${editForm.id}`, {
        role: editForm.role,
        department: editForm.department,
        departmentId: editForm.departmentId,
        team: editForm.team,
        teamId: editForm.teamId,
        password: editForm.password, // 비어있으면 백엔드에서 무시함
      });
      toast.success("정상적으로 수정되었습니다.");
      setShowEditModal(false);
      fetchUsers();
    } catch (error) {
      toast.error(getErrorMessage(error, "수정 중 오류가 발생했습니다."));
    }
  };

  // 사용자 삭제 핸들러
  const handleDelete = async (id: number) => {
    if (
      !window.confirm(
        "정말 이 사용자를 삭제하시겠습니까?\n삭제 시 해당 사용자의 모든 이수 내역과 파일도 함께 삭제됩니다.",
      )
    ) {
      return;
    }

    try {
      await api.delete(`/users/${id}`);
      toast.success("정상적으로 삭제되었습니다.");
      fetchUsers();
    } catch (error) {
      toast.error(getErrorMessage(error, "삭제 중 오류가 발생했습니다."));
    }
  };

  return (
    <div className="h-full flex flex-col gap-6">
      {/* 헤더 */}
      <div className="shrink-0">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          사용자 관리
        </h1>
        <p className="text-base text-gray-500 dark:text-gray-400 mt-1">
          부서원 계정을 등록하고 관리합니다.
        </p>
      </div>
      <div className="shrink-0 flex flex-col gap-3">
        {/* 버튼 행 — 총괄담당 이상만 표시 */}
        {canManageUsers && (
          <div className="flex flex-wrap items-center gap-2">
            <ActionButton
              onClick={handleDownloadTemplate}
              className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
              title="엑셀 등록 양식 다운로드"
            >
              📋 양식
            </ActionButton>

            <ActionButton
              onClick={handleDownloadUsersCSV}
              className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
              title="현재 목록을 CSV로 다운로드 (일괄변경용)"
            >
              📥 목록 다운로드
            </ActionButton>

            <div className="h-8 w-px bg-gray-300 dark:bg-gray-600 mx-1 hidden sm:block" />

            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              ref={fileInputRef}
              onChange={handleExcelUpload}
              className="hidden"
            />
            <ActionButton onClick={() => fileInputRef.current?.click()}>
              📂 엑셀 일괄등록
            </ActionButton>

            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              ref={fileEditRef}
              onChange={handleEditExcelUpload}
              className="hidden"
            />
            <ActionButton
              onClick={() => fileEditRef.current?.click()}
              className="bg-red-600 hover:bg-red-700"
            >
              🛠️ 엑셀 일괄변경
            </ActionButton>

            <div className="h-8 w-px bg-gray-300 dark:bg-gray-600 mx-1 hidden sm:block" />

            <ActionButton
              onClick={() => setShowCreateModal(true)}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              🪪 사용자 등록
            </ActionButton>

            <ActionButton
              onClick={handleResetUsers}
              title="일반직원 및 팀담당자 전체 삭제"
              className="bg-red-50 hover:bg-red-100 text-red-600"
            >
              🗑️ 초기화
            </ActionButton>
          </div>
        )}

        {/* 필터 행 */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            placeholder="성명 또는 ID 검색"
            className="w-44 px-3 py-2 text-base rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <Select
            value={filterDepartment}
            onChange={(e) => {
              const deptId = Number(e.target.value);
              setFilterDepartment(deptId);
              setFilterTeam(-1);
              handleTeams(deptId);
            }}
            options={departmentOptions}
            className="w-48"
          />
          <Select
            value={filterTeam}
            onChange={(e) => setFilterTeam(Number(e.target.value))}
            options={teamOptions}
            className="w-48"
          />
          <Select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            options={roleOptions}
            className="w-42"
          />
        </div>
      </div>

      {/* 사용자 목록 테이블 */}
      <div className="flex-1 min-h-0 bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 transition-colors duration-700 overflow-hidden flex flex-col">
        <div className="overflow-y-auto scrollbar-hide flex-1">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700 transition-colors duration-700 sticky top-0 z-10">
              <tr>
                <TableHeader>이름 (ID)</TableHeader>
                <TableHeader>부서</TableHeader>
                <TableHeader>팀(계)</TableHeader>
                <TableHeader>권한</TableHeader>
                <TableHeader className="pr-8 text-right">관리</TableHeader>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700 transition-colors duration-700">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="text-center py-4 text-gray-500 dark:text-gray-400"
                  >
                    로딩 중...
                  </td>
                </tr>
              ) : filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    onClick={() => openStatusModal(user.id, user.name)}
                    className="hover:bg-indigo-50 dark:hover:bg-indigo-900/20 cursor-pointer"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-base text-center font-medium text-gray-900 dark:text-white">
                        {user.name}
                      </div>
                      <div className="text-base text-center text-gray-500 dark:text-gray-400">
                        {user.username}
                      </div>
                    </td>
                    <TableRow>{user.department}</TableRow>
                    <TableRow>{user.team}</TableRow>
                    <TableRow>{getRoleLabel(user.role)}</TableRow>
                    <TableRow>
                      {canManageUsers &&
                        (currentUser?.role === roles["시스템관리자"] ||
                          (currentUser?.role &&
                            user.role < currentUser?.role)) && (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditModal(user);
                              }}
                              className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 px-3 py-1 rounded transition"
                            >
                              수정
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(user.id);
                              }}
                              className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 px-3 py-1 rounded transition"
                            >
                              삭제
                            </button>
                          </div>
                        )}
                    </TableRow>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="text-center py-8 text-gray-500 dark:text-gray-400"
                  >
                    조건에 맞는 사용자가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {users.length === 0 && !isLoading && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            등록된 사용자가 없습니다.
          </div>
        )}
      </div>

      {showCreateModal && (
        <UserCreateModal
          form={createForm}
          onChange={setCreateForm}
          onSubmit={handleCreate}
          onClose={() => setShowCreateModal(false)}
          departmentOptions={assignableDepartmentOptions}
          allTeams={allTeams}
          roleOptions={editRoleOptions}
        />
      )}

      {showEditModal && (
        <UserEditModal
          form={editForm}
          onChange={setEditForm}
          onSubmit={handleUpdate}
          onClose={() => setShowEditModal(false)}
          departmentOptions={assignableDepartmentOptions}
          allTeams={allTeams}
          roleOptions={editRoleOptions}
        />
      )}

      {showStatusModal && selectedUserId !== null && (
        <UserStatusModal
          userId={selectedUserId}
          userName={selectedUserName}
          onClose={() => setShowStatusModal(false)}
        />
      )}
    </div>
  );
};

export default AdminUserPage;
