import FormButton from "./FormButton";
import FormLabel from "./FormLabel";
import Select from "./Select";
import TextInput from "./TextInput";
import { applyDepartmentChange, applyTeamChange, useTeamSelect } from "../hooks/useTeamSelect";
import type { SelectOption, Team } from "../types";

export interface NewUserForm {
  username: string;
  password: string;
  name: string;
  department: string;
  departmentId: number;
  team: string;
  teamId: number;
  role: number;
}

interface UserCreateModalProps {
  form: NewUserForm;
  onChange: (form: NewUserForm) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  departmentOptions: SelectOption[];
  allTeams: Team[];
  roleOptions: SelectOption[];
}

const UserCreateModal = ({
  form,
  onChange,
  onSubmit,
  onClose,
  departmentOptions,
  allTeams,
  roleOptions,
}: UserCreateModalProps) => {
  // 선택된 부서의 팀(계) 목록은 form.departmentId에서 항상 파생되므로,
  // 부모가 별도 상태로 들고 있을 필요 없이 여기서 바로 계산한다.
  const { teams: formTeams, teamOptions: formTeamOptions } = useTeamSelect(
    allTeams,
    form.departmentId,
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md shadow-xl border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
          새 사용자 등록
        </h2>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <FormLabel>고유식별번호 (ID)</FormLabel>
            <TextInput
              value={form.username}
              onChange={(e) => onChange({ ...form, username: e.target.value })}
            />
          </div>
          <div>
            <FormLabel>이름</FormLabel>
            <TextInput
              value={form.name}
              onChange={(e) => onChange({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <FormLabel>초기 비밀번호</FormLabel>
            <TextInput
              type="password"
              value={form.password}
              onChange={(e) => onChange({ ...form, password: e.target.value })}
            />
          </div>
          <div className="flex-1">
            <FormLabel>부서</FormLabel>
            <Select
              options={departmentOptions}
              value={form.departmentId}
              onChange={(e) =>
                onChange(
                  applyDepartmentChange(
                    form,
                    departmentOptions,
                    Number(e.target.value),
                  ),
                )
              }
            />
          </div>
          <div className="flex-1">
            <FormLabel>팀(계)</FormLabel>
            <Select
              value={form.teamId}
              onChange={(e) =>
                onChange(
                  applyTeamChange(form, formTeams, Number(e.target.value)),
                )
              }
              options={formTeamOptions}
            />
          </div>
          <div>
            <FormLabel>권한</FormLabel>
            <Select
              value={form.role}
              onChange={(e) =>
                onChange({ ...form, role: Number(e.target.value) })
              }
              options={roleOptions}
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
              등록하기
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserCreateModal;
