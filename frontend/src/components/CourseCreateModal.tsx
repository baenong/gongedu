import FormButton from "./FormButton";
import FormLabel from "./FormLabel";
import Select from "./Select";
import TextInput from "./TextInput";
import { useAuthStore } from "../store/authStore";
import { roles } from "../utils/constants";

export interface NewCourseForm {
  name: string;
  end_date: string;
  detail: string;
  department_id: number;
}

interface CourseCreateModalProps {
  newCourse: NewCourseForm;
  onChange: (course: NewCourseForm) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  departmentOptions: { value: number; label: string }[];
}

const CourseCreateModal = ({
  newCourse,
  onChange,
  onSubmit,
  onClose,
  departmentOptions,
}: CourseCreateModalProps) => {
  const user = useAuthStore((state) => state.user);
  const isEducator = user?.role === roles["교육담당"];
  const educatorDepartmentOption = {
    value: user?.departmentId ?? 0,
    label: user?.department || "미지정",
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md shadow-xl">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
          새 교육과정 등록
        </h2>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <FormLabel>교육명</FormLabel>
            <TextInput
              value={newCourse.name}
              onChange={(e) =>
                onChange({ ...newCourse, name: e.target.value })
              }
            />
          </div>
          <div>
            <FormLabel>마감일자</FormLabel>
            <TextInput
              type="date"
              value={newCourse.end_date}
              onChange={(e) =>
                onChange({ ...newCourse, end_date: e.target.value })
              }
            />
          </div>
          <div>
            <FormLabel>주관부서</FormLabel>
            {isEducator ? (
              <Select
                value={newCourse.department_id}
                disabled
                onChange={() => {}}
                options={[educatorDepartmentOption]}
              />
            ) : (
              <Select
                value={newCourse.department_id}
                onChange={(e) =>
                  onChange({
                    ...newCourse,
                    department_id: Number(e.target.value),
                  })
                }
                options={departmentOptions}
              />
            )}
          </div>
          <div>
            <FormLabel>상세정보 (선택)</FormLabel>
            <textarea
              rows={4}
              value={newCourse.detail}
              onChange={(e) =>
                onChange({ ...newCourse, detail: e.target.value })
              }
              className="w-full border rounded px-3 py-2 resize-none dark:bg-gray-700 dark:text-white dark:border-gray-600"
              placeholder="내용을 입력하지 않아도 등록 가능합니다."
            />
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <FormButton onClick={onClose} className="dark:hover:bg-gray-600">
              취소
            </FormButton>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
            >
              등록하기
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CourseCreateModal;
