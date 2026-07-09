import { useMemo } from "react";
import FormButton from "./FormButton";
import FormLabel from "./FormLabel";
import Select from "./Select";
import TextInput from "./TextInput";
import type { SelectOption, Team } from "../types";

export interface EditUserForm {
  id: number;
  username: string;
  name: string;
  department: string;
  departmentId: number;
  team: string;
  teamId: number;
  password: string;
  role: number;
}

interface UserEditModalProps {
  form: EditUserForm;
  onChange: (form: EditUserForm) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  departmentOptions: SelectOption[];
  allTeams: Team[];
  roleOptions: SelectOption[];
}

const UserEditModal = ({
  form,
  onChange,
  onSubmit,
  onClose,
  departmentOptions,
  allTeams,
  roleOptions,
}: UserEditModalProps) => {
  // 선택된 부서의 팀(계) 목록은 form.departmentId에서 항상 파생되므로,
  // 부모가 별도 상태로 들고 있을 필요 없이 여기서 바로 계산한다.
  const formTeams = useMemo(
    () => allTeams.filter((t) => t.departmentId === form.departmentId),
    [allTeams, form.departmentId],
  );
  const formTeamOptions = [
    { label: "모든 팀(계)", value: -1 },
    ...formTeams.map((t) => ({ label: t.name, value: t.id })),
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md shadow-xl border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
          사용자 정보 수정
        </h2>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded text-base text-gray-600 dark:text-gray-300 mb-4">
            <p>
              <b>ID:</b> {form.username}
            </p>
            <p>
              <b>성명:</b> {form.name}
            </p>
          </div>

          <div>
            <FormLabel>부서 변경</FormLabel>
            <Select
              value={form.departmentId}
              onChange={(e) => {
                const deptId = Number(e.target.value);
                const deptName =
                  departmentOptions.find((d) => d.value === deptId)?.label ??
                  "";
                onChange({
                  ...form,
                  department: deptName,
                  departmentId: deptId,
                  team: "",
                  teamId: 0,
                });
              }}
              options={departmentOptions}
            />
          </div>

          <div>
            <FormLabel>팀계 변경</FormLabel>
            <Select
              value={form.teamId}
              onChange={(e) => {
                const teamId = Number(e.target.value);
                const teamName =
                  formTeams.find((t) => t.id === teamId)?.name ?? "";
                onChange({ ...form, teamId, team: teamName });
              }}
              options={formTeamOptions}
            />
          </div>

          <div>
            <FormLabel>권한 변경</FormLabel>
            <Select
              value={form.role}
              onChange={(e) =>
                onChange({ ...form, role: Number(e.target.value) })
              }
              options={roleOptions}
            />
          </div>

          <div>
            <FormLabel>비밀번호 변경</FormLabel>
            <TextInput
              type="password"
              isRequired={false}
              placeholder="변경하려면 입력하세요 (비워두면 유지)"
              value={form.password}
              onChange={(e) => onChange({ ...form, password: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <FormButton onClick={onClose} className="dark:hover:bg-gray-600">
              취소
            </FormButton>
            <button
              type="submit"
              className="px-4 py-2 text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition"
            >
              수정완료
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserEditModal;
