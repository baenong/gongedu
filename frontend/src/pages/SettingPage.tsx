import { useEffect, useEffectEvent, useRef, useState } from "react";
import api from "../api/axios";
import { getErrorMessage } from "../utils/errorUtils";
import toast from "react-hot-toast";
import TextInput from "../components/TextInput";
import FormLabel from "../components/FormLabel";
import FormButton from "../components/FormButton";
import ActionButton from "../components/ActionButton";
import type { Department, Team } from "../types";
import GroupRow from "../components/GroupRow";
import ScrollFade from "../components/ScrollFade";

const frameStyle = "h-62 p-1 overflow-y-auto scrollbar-hide";
const btnFrameStyle = "flex flex-wrap justify-between";

const SettingPage = () => {
  const [settings, setSettings] = useState({ ipWhitelist: "" });

  const deptFileRef = useRef<HTMLInputElement>(null);
  const teamFileRef = useRef<HTMLInputElement>(null);

  // 부서 정보
  const [departments, setDepartments] = useState<Department[]>([]);
  const [deptName, setDeptName] = useState("");
  const [deptIdx, setDeptIdx] = useState(0);
  const [selectedDept, setSelectedDept] = useState(0);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamName, setTeamName] = useState("");
  const [teamIdx, setTeamIdx] = useState(0);
  const [selectedTeam, setSelectedTeam] = useState(0);

  // 데이터 정리 관련 상태
  const [cleanupYear, setCleanupYear] = useState(new Date().getFullYear() - 1); // 기본값: 작년
  const [cleanupMode, setCleanupMode] = useState<"files_only" | "all">(
    "files_only",
  );

  // 설정 불러오기
  // const fetchSettings = async () => {
  //   try {
  //     const response = await api.get("/settings");
  //     // DB에 없는 키가 있을 수 있으므로 기본값 병합
  //     setSettings((prev) => ({ ...prev, ...response.data }));
  //   } catch (error) {
  //     toast.error(
  //       getErrorMessage(error, "설정 로드에 실패했습니다. 서버를 확인하세요"),
  //     );
  //   }
  // };

  const handleSave = async (key: string, value: string) => {
    try {
      await api.post("/settings", { key, value });
      toast.success("설정이 저장되었습니다.");
    } catch (error) {
      toast.error(getErrorMessage(error, "설정 저장을 실패했습니다."));
    }
  };

  // 부서 관련 핸들러
  const getDepartments = async () => {
    try {
      const response = await api.get("/departments");
      setDepartments(response.data);
    } catch (error) {
      toast.error(getErrorMessage(error, "부서 목록을 불러올 수 없습니다."));
    }
  };

  const addDepartment = async () => {
    try {
      if (deptName && deptIdx) {
        const response = await api.post("/departments", {
          name: deptName,
          orderIndex: deptIdx,
        });

        const deptData: Department = {
          id: response.data.id,
          name: deptName,
          orderIndex: deptIdx,
        };
        setDepartments(
          [...departments, deptData].sort((a, b) => a.orderIndex - b.orderIndex),
        );
        setSelectedDept(0);
        toast.success("부서가 추가되었습니다.");
      } else {
        toast.error("부서명과 인덱스를 입력하세요");
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "부서 추가에 실패했습니다."));
    }
  };

  const editDepartment = async () => {
    if (selectedDept == 0) return;
    try {
      if (deptName && deptIdx) {
        await api.put(`/departments/${selectedDept}`, {
          name: deptName,
          orderIndex: deptIdx,
        });

        const deptData: Department = {
          id: selectedDept,
          name: deptName,
          orderIndex: deptIdx,
        };

        const tempDepts = departments
          .map((dept) => (dept.id === deptData.id ? deptData : dept))
          .sort((a, b) => a.orderIndex - b.orderIndex);
        setDepartments(tempDepts);
        toast.success("부서가 수정되었습니다.");
      } else {
        toast.error("부서명과 인덱스를 입력하세요");
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "부서 편집에 실패했습니다."));
    }
  };

  const getAllTeams = useEffectEvent(async () => {
    try {
      const response = await api.get("/departments/teams");
      setAllTeams(response.data);
    } catch (error) {
      toast.error(getErrorMessage(error, "팀/계 목록을 불러올 수 없습니다."));
    }
  });

  const getTeamsById = useEffectEvent((deptId: number) => {
    if (deptId == 0) {
      setTeams([]);
      return;
    }
    const teamDatas: Team[] = [];
    try {
      allTeams.map((team) => {
        if (team.departmentId == deptId) {
          teamDatas.push(team);
        }
      });
      setTeams(teamDatas);
    } catch (error) {
      toast.error(getErrorMessage(error, "팀/계 목록을 불러올 수 없습니다."));
    }
  });

  const addTeam = async () => {
    try {
      if (teamName && teamIdx) {
        const response = await api.post("/departments/teams", {
          name: teamName,
          orderIndex: teamIdx,
          departmentId: selectedDept,
        });

        const teamData: Team = {
          id: response.data.id,
          name: teamName,
          orderIndex: teamIdx,
          departmentId: selectedDept,
        };

        setAllTeams(
          [...allTeams, teamData].sort((a, b) => a.orderIndex - b.orderIndex),
        );
        setTeams(
          [...teams, teamData].sort((a, b) => a.orderIndex - b.orderIndex),
        );
        setSelectedTeam(0);
        toast.success("팀/계가 추가되었습니다.");
      } else {
        toast.error("부서명과 인덱스를 입력하세요");
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "부서 추가에 실패했습니다."));
    }
  };

  const editTeam = async () => {
    if (selectedTeam == 0) return;
    try {
      if (teamName && teamIdx) {
        await api.put(`/departments/teams/${selectedTeam}`, {
          name: teamName,
          orderIndex: teamIdx,
          departmentId: selectedDept,
        });

        const teamData: Team = {
          id: selectedTeam,
          name: teamName,
          orderIndex: teamIdx,
          departmentId: selectedDept,
        };

        const tempAllTeams = allTeams
          .map((team) => (team.id === teamData.id ? teamData : team))
          .sort((a, b) => a.orderIndex - b.orderIndex);
        setAllTeams(tempAllTeams);

        const tempTeams = teams
          .map((team) => (team.id === teamData.id ? teamData : team))
          .sort((a, b) => a.orderIndex - b.orderIndex);
        setTeams(tempTeams);

        setSelectedTeam(0);
        setTeamName("");
        setTeamIdx(0);
        toast.success("팀/계가 수정되었습니다.");
      } else {
        toast.error("팀/계명과 인덱스를 입력하세요");
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "팀/계 수정에 실패했습니다."));
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const response = await api.get("/settings");
        // DB에 없는 키가 있을 수 있으므로 기본값 병합
        setSettings((prev) => ({ ...prev, ...response.data }));
      } catch (error) {
        toast.error(
          getErrorMessage(error, "설정 로드에 실패했습니다. 서버를 확인하세요"),
        );
      }
    })();
    //fetchSettings();
    getDepartments();
    getAllTeams();
  }, []);

  useEffect(() => {
    getTeamsById(selectedDept);
  }, [selectedDept]);

  // 데이터 정리 핸들러
  const handleCleanup = async () => {
    const msg =
      cleanupMode === "files_only"
        ? `${cleanupYear}년도의 "수료증 파일"만 삭제하시겠습니까?\n이수 기록은 유지되며 용량이 확보됩니다.`
        : `⚠️ 경고: ${cleanupYear}년도의 모든 데이터(교육과정, 이수기록, 파일)가 영구 삭제됩니다.\n정말 진행하시겠습니까?`;

    if (!window.confirm(msg)) return;

    try {
      const response = await api.delete("/settings/cleanup", {
        data: { year: cleanupYear, mode: cleanupMode },
      });
      toast.success(response.data.message);
    } catch (error) {
      toast.error(getErrorMessage(error, "정리 작업 실패"));
    }
  };

  const deleteDepartment = async () => {
    if (selectedDept === 0) return;
    const target = departments.find((d) => d.id === selectedDept);
    if (
      !window.confirm(
        `"${target?.name}" 부서를 삭제하시겠습니까?\n소속된 팀/계도 함께 삭제됩니다.`,
      )
    )
      return;
    try {
      await api.delete(`/departments/${selectedDept}`);
      setDepartments(departments.filter((d) => d.id !== selectedDept));
      setAllTeams(allTeams.filter((t) => t.departmentId !== selectedDept));
      setTeams([]);
      setSelectedDept(0);
      setDeptName("");
      setDeptIdx(0);
      setSelectedTeam(0);
      toast.success("부서가 삭제되었습니다.");
    } catch (error) {
      toast.error(getErrorMessage(error, "부서 삭제에 실패했습니다."));
    }
  };

  const deleteTeam = async () => {
    if (selectedTeam === 0) return;
    const target = teams.find((t) => t.id === selectedTeam);
    if (!window.confirm(`"${target?.name}" 팀/계를 삭제하시겠습니까?`)) return;
    try {
      await api.delete(`/departments/teams/${selectedTeam}`);
      setAllTeams(allTeams.filter((t) => t.id !== selectedTeam));
      setTeams(teams.filter((t) => t.id !== selectedTeam));
      setSelectedTeam(0);
      setTeamName("");
      setTeamIdx(0);
      toast.success("팀/계가 삭제되었습니다.");
    } catch (error) {
      toast.error(getErrorMessage(error, "팀/계 삭제에 실패했습니다."));
    }
  };

  const refreshDepartments = async () => {
    try {
      const response = await api.get("/departments");
      setDepartments(response.data);
    } catch (error) {
      toast.error(getErrorMessage(error, "부서 목록을 불러올 수 없습니다."));
    }
  };

  const handleDeptExcelUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm(`${file.name} 파일을 업로드하여 일괄 등록하시겠습니까?`)) {
      if (deptFileRef.current) deptFileRef.current.value = "";
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    const toastId = toast.loading("처리 중...");

    try {
      const res = await api.post("/departments/upload-excel", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success(res.data.message, { id: toastId, duration: 4000 });
      await refreshDepartments();
    } catch (error) {
      toast.error(getErrorMessage(error, "업로드 실패"), { id: toastId });
    } finally {
      if (deptFileRef.current) deptFileRef.current.value = "";
    }
  };

  const refreshAllTeams = async () => {
    try {
      const response = await api.get("/departments/teams");
      setAllTeams(response.data);
    } catch (error) {
      toast.error(getErrorMessage(error, "팀/계 목록을 불러올 수 없습니다."));
    }
  };

  const handleTeamExcelUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm(`${file.name} 파일을 업로드하여 일괄 등록하시겠습니까?`)) {
      if (teamFileRef.current) teamFileRef.current.value = "";
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    const toastId = toast.loading("처리 중...");

    try {
      const res = await api.post("/departments/teams/upload-excel", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success(res.data.message, { id: toastId, duration: 4000 });
      await refreshAllTeams();
    } catch (error) {
      toast.error(getErrorMessage(error, "업로드 실패"), { id: toastId });
    } finally {
      if (teamFileRef.current) teamFileRef.current.value = "";
    }
  };

  const handleTeamReset = async () => {
    if (
      !window.confirm(
        "⚠️ 경고: 모든 팀/계 데이터가 삭제됩니다.\n\n" +
          "· 모든 직원의 팀 정보가 초기화됩니다.\n" +
          "· 팀계담당 권한이 일반직원으로 변경됩니다.\n" +
          "· 부서 정보와 부서담당 권한은 유지됩니다.\n\n" +
          "진행 전 반드시 모든 관리자가 로그아웃한 상태여야 합니다.\n" +
          "정말 진행하시겠습니까?",
      )
    )
      return;

    try {
      const res = await api.delete("/departments/teams/reset");
      toast.success(res.data.message);
      setAllTeams([]);
      setTeams([]);
      setSelectedTeam(0);
      setTeamName("");
      setTeamIdx(0);
    } catch (error) {
      toast.error(getErrorMessage(error, "초기화 실패"));
    }
  };

  const handleOrgReset = async () => {
    if (
      !window.confirm(
        "⚠️ 경고: 모든 부서와 팀/계 데이터가 삭제됩니다.\n\n" +
          "· 모든 직원의 부서·팀 정보가 초기화됩니다.\n" +
          "· 팀계담당·부서담당 권한이 일반직원으로 초기화됩니다.\n\n" +
          "진행 전 반드시 모든 관리자가 로그아웃한 상태여야 합니다.\n" +
          "정말 진행하시겠습니까?",
      )
    )
      return;

    try {
      const res = await api.delete("/departments/reset");
      toast.success(res.data.message);
      setDepartments([]);
      setAllTeams([]);
      setTeams([]);
      setSelectedDept(0);
      setSelectedTeam(0);
      setDeptName("");
      setDeptIdx(0);
      setTeamName("");
      setTeamIdx(0);
    } catch (error) {
      toast.error(getErrorMessage(error, "초기화 실패"));
    }
  };

  const handleDownloadDeptTemplate = () => {
    const csvContent = "﻿name,orderIndex\n총무과,1\n기획과,2";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "부서등록_양식.csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const handleDownloadTeamTemplate = () => {
    const header = "﻿name,orderIndex,department";
    const deptHints =
      departments.length > 0
        ? departments
            .map((d) => `${d.name}의 팀 예시,1,${d.name}`)
            .slice(0, 3)
            .join("\n")
        : "총무계,1,총무과\n인사계,2,총무과";
    const csvContent = `${header}\n${deptHints}`;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "팀계등록_양식.csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  return (
    <div className="space-y-8 pb-32">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          시스템 설정
        </h1>
        <p className="text-base text-gray-500 dark:text-gray-400 mt-1">
          시스템 환경을 설정합니다.
        </p>
      </div>

      <section className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 border border-gray-200 dark:border-gray-700 transition-colors">
        {/* 부서정보를 업로드하는 화면 */}
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">
          부서 정보
        </h2>
        <div className="space-y-6">
          <hr className="border-gray-300 dark:border-gray-700" />
          <div className="flex">
            <div className="flex-1 pr-4">
              <div className="flex justify-between mb-2">
                <FormLabel className="pl-3 flex items-center text-lg">
                  부서
                </FormLabel>
                <div className={`${btnFrameStyle} gap-1.5`}>
                  <ActionButton
                    onClick={handleDownloadDeptTemplate}
                    className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
                    title="부서 등록 양식 다운로드"
                  >
                    📋 양식
                  </ActionButton>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    ref={deptFileRef}
                    onChange={handleDeptExcelUpload}
                    className="hidden"
                  />
                  <ActionButton onClick={() => deptFileRef.current?.click()}>
                    📂 엑셀 일괄등록
                  </ActionButton>
                </div>
              </div>
              <div className={btnFrameStyle}>
                <div className="flex gap-1.5">
                  <TextInput
                    value={deptName}
                    onChange={(e) => setDeptName(e.target.value)}
                    className="w-48 inline-block"
                  />
                  <TextInput
                    value={deptIdx}
                    type="number"
                    onChange={(e) => setDeptIdx(Number(e.target.value))}
                    className="w-16 inline-block no-spinner text-center"
                  />
                </div>

                <div className="flex gap-1.5">
                  {selectedDept > 0 ? (
                    <ActionButton
                      onClick={editDepartment}
                      className="bg-amber-500 hover:bg-amber-600"
                    >
                      ✏️ 편집
                    </ActionButton>
                  ) : (
                    <ActionButton
                      onClick={addDepartment}
                      className="bg-sky-500 hover:bg-sky-600"
                    >
                      ✏️ 추가
                    </ActionButton>
                  )}
                  <ActionButton
                    onClick={deleteDepartment}
                    disabled={selectedDept == 0}
                    className="bg-red-500 hover:bg-red-600"
                  >
                    🗑️ 삭제
                  </ActionButton>
                </div>
              </div>

              <ScrollFade className={frameStyle}>
                {departments.map((dept) => {
                  return (
                    <GroupRow
                      group={dept}
                      key={dept.id}
                      selected={selectedDept}
                      onClick={() => {
                        if (dept.id != selectedDept) {
                          setSelectedDept(dept.id);
                          setDeptName(dept.name);
                          setDeptIdx(dept.orderIndex);
                        } else {
                          setSelectedDept(0);
                          setDeptName("");
                          setDeptIdx(0);
                        }

                        setSelectedTeam(0);
                        setTeamName("");
                        setTeamIdx(0);
                      }}
                    />
                  );
                })}
              </ScrollFade>
            </div>
            <div className="flex-1 pl-4">
              <div className="flex justify-between mb-2">
                <FormLabel className="pl-3 flex items-center text-lg">
                  팀/계
                </FormLabel>
                <div className="flex gap-1.5">
                  <ActionButton
                    onClick={handleDownloadTeamTemplate}
                    className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
                    title="팀/계 등록 양식 다운로드"
                  >
                    📋 양식
                  </ActionButton>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    ref={teamFileRef}
                    onChange={handleTeamExcelUpload}
                    className="hidden"
                  />
                  <ActionButton onClick={() => teamFileRef.current?.click()}>
                    📂 엑셀 일괄등록
                  </ActionButton>
                </div>
              </div>

              <div
                className={`${btnFrameStyle} ${selectedDept > 0 ? "visible" : "invisible pointer-events-none"}`}
              >
                <div className="flex gap-1.5">
                  <TextInput
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    className="w-48 inline-block"
                  />
                  <TextInput
                    value={teamIdx}
                    type="number"
                    onChange={(e) => setTeamIdx(Number(e.target.value))}
                    className="w-16 inline-block no-spinner text-center"
                  />
                </div>
                <div className="flex gap-1.5">
                  {selectedTeam > 0 ? (
                    <ActionButton
                      onClick={editTeam}
                      className="bg-amber-500 hover:bg-amber-600"
                    >
                      ✏️ 편집
                    </ActionButton>
                  ) : (
                    <ActionButton
                      onClick={addTeam}
                      className="bg-sky-500 hover:bg-sky-600"
                    >
                      ✏️ 추가
                    </ActionButton>
                  )}
                  <ActionButton
                    onClick={deleteTeam}
                    disabled={selectedTeam == 0}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    🗑️ 삭제
                  </ActionButton>
                </div>
              </div>

              <ScrollFade className={frameStyle}>
                {teams.map((team) => {
                  return (
                    <GroupRow
                      key={team.id}
                      group={team}
                      selected={selectedTeam}
                      onClick={() => {
                        if (team.id != selectedTeam) {
                          setSelectedTeam(team.id);
                          setTeamName(team.name);
                          setTeamIdx(team.orderIndex);
                        } else {
                          setSelectedTeam(0);
                          setTeamName("");
                          setTeamIdx(0);
                        }
                      }}
                    />
                  );
                })}
              </ScrollFade>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 border border-gray-200 dark:border-gray-700 transition-colors">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">
          IP 설정
        </h2>
        <div className="space-y-6">
          {/* <div className="flex flex-col sm:flex-row gap-4 items-end sm:items-center">
            <div className="flex-1 w-full">
              <FormLabel>부서명 (Department Name)</FormLabel>
              <p className="text-base text-gray-500 dark:text-gray-400 mb-2">
                수료증 파일명 생성 시 접두어로 사용됩니다. (예: [행정지원과]...)
              </p>
              <TextInput
                value={settings.department_name}
                onChange={(e) =>
                  setSettings({ ...settings, department_name: e.target.value })
                }
              />
            </div>

            <button
              onClick={() =>
                handleSave("department_name", settings.department_name)
              }
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-10 rounded-md text-base font-medium transition"
            >
              저장
            </button>
          </div> */}

          <hr className="border-gray-300 dark:border-gray-700" />

          {/* IP 설정 */}
          <div className="flex flex-col sm:flex-row gap-4 items-end sm:items-center">
            <div className="flex-1 w-full">
              <FormLabel>허용 IP 범위 (CIDR 형식)</FormLabel>

              <p className="text-base text-gray-500 dark:text-gray-400 mb-2">
                접속을 허용할 IP 또는 대역(CIDR)을 입력하세요. 쉼표(,)로
                구분하여 여러 개 입력 가능합니다.
                <br />
                (예: <code>192.168.0.0/24, 10.50.10.5</code>) <br />
                <span className="text-red-500 dark:text-red-400">
                  * 비어있으면 모든 IP 접속 허용
                </span>
              </p>
              <TextInput
                value={settings.ipWhitelist}
                onChange={(e) =>
                  setSettings({ ...settings, ipWhitelist: e.target.value })
                }
                placeholder="예: 192.168.0.0/24"
              />
            </div>
            <FormButton
              onClick={() =>
                handleSave("allowed_ip_range", settings.ipWhitelist)
              }
              className="px-4 py-16 dark:hover:bg-gray-600"
            >
              저장
            </FormButton>
          </div>
        </div>
      </section>

      <section className="bg-red-50 dark:bg-red-900/10 shadow rounded-lg p-6 border border-red-200 dark:border-red-900/30 transition-colors">
        <h2 className="text-lg font-semibold text-red-800 dark:text-red-300 mb-4">
          데이터 및 파일 정리
        </h2>
        <p className="text-base text-red-600 dark:text-red-400 mb-6">
          연도가 지난 교육 자료와 수료증 파일을 정리하여 <b>PC 용량을 확보</b>할
          수 있습니다.
        </p>

        <div className="flex flex-col md:flex-row gap-6 items-start md:items-end">
          <div>
            <FormLabel>대상 연도</FormLabel>
            <input
              type="number"
              className="border border-gray-300 dark:border-gray-600 rounded px-3 py-2 w-32 outline-none focus:ring-2 focus:ring-red-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              value={cleanupYear}
              onChange={(e) => setCleanupYear(Number(e.target.value))}
            />
          </div>

          {/* 삭제 모드 선택 */}
          <div className="flex flex-col gap-2">
            <span className="block text-base font-medium text-gray-700 dark:text-gray-300">
              정리 방식
            </span>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  checked={cleanupMode === "files_only"}
                  onChange={() => setCleanupMode("files_only")}
                  className="text-red-600 focus:ring-red-500"
                />
                <span className="text-base text-gray-800 dark:text-gray-200">
                  <b>파일만 삭제</b> (용량 확보, 이수기록 유지)
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="mode"
                  checked={cleanupMode === "all"}
                  onChange={() => setCleanupMode("all")}
                  className="text-red-600 focus:ring-red-500"
                />
                <span className="text-base text-gray-800 dark:text-gray-200">
                  전체 삭제 (데이터 포함)
                </span>
              </label>
            </div>
          </div>

          <button
            onClick={handleCleanup}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-md text-base font-bold transition shadow-sm ml-auto"
          >
            실행하기
          </button>
        </div>
      </section>

      <section className="bg-red-50 dark:bg-red-900/10 shadow rounded-lg p-6 border border-red-200 dark:border-red-900/30 transition-colors">
        <h2 className="text-lg font-semibold text-red-800 dark:text-red-300 mb-4">
          부서·팀 정보 초기화
        </h2>
        <p className="text-base text-red-600 dark:text-red-400 mb-6">
          <span className="text-red-500 dark:text-red-400">
            반드시 모든 관리자가 로그아웃한 상태에서 진행하세요.
          </span>
          <br />새 조직 구조 엑셀 일괄등록 전 사용하세요.
        </p>
        <div className="flex flex-col gap-4">
          {/* 팀만 초기화 */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 bg-white dark:bg-gray-800 rounded-lg border border-red-200 dark:border-red-900/40">
            <div>
              <p className="text-base font-semibold text-gray-800 dark:text-gray-100">
                팀/계만 초기화
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                팀/계 전체 삭제 · 직원 팀 정보 초기화 · 팀계담당 → 일반직원
              </p>
            </div>
            <button
              onClick={handleTeamReset}
              className="shrink-0 bg-red-500 hover:bg-red-600 text-white px-5 py-2 rounded-md text-base font-bold transition shadow-sm"
            >
              팀/계 초기화
            </button>
          </div>

          {/* 부서+팀 전체 초기화 */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 bg-white dark:bg-gray-800 rounded-lg border border-red-200 dark:border-red-900/40">
            <div>
              <p className="text-base font-semibold text-gray-800 dark:text-gray-100">
                부서·팀 전체 초기화
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                부서·팀 전체 삭제 · 직원 부서·팀 정보 초기화 · 팀계담당·부서담당
                → 일반직원
              </p>
            </div>
            <button
              onClick={handleOrgReset}
              className="shrink-0 bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-md text-base font-bold transition shadow-sm"
            >
              부서·팀 전체 초기화
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default SettingPage;
