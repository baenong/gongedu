import { useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import api from "../api/axios";
import Badge from "./Badge";
import FormButton from "./FormButton";
import Select from "./Select";
import TableHeader from "./TableHeader";
import TableRow from "./TableRow";
import { formatDateWithDay } from "../utils/dateUtils";

export interface UserEnrollmentStatus {
  course_id: number;
  course_name: string;
  end_date: string;
  state: number | null;
  submitted_at: string | null;
  file_name: string | null;
}

interface UserStatusModalProps {
  userId: number;
  userName: string;
  onClose: () => void;
}

const UserStatusModal = ({ userId, userName, onClose }: UserStatusModalProps) => {
  const thisYear = new Date().getFullYear();
  const [statusYear, setStatusYear] = useState(thisYear);
  const [statusList, setStatusList] = useState<UserEnrollmentStatus[]>([]);

  const yearOptions = [thisYear - 1, thisYear, thisYear + 1, thisYear + 2].map(
    (y) => ({ value: y, label: `${y}년` }),
  );

  useEffect(() => {
    (async () => {
      try {
        const response = await api.get(
          `/enrollments/status/user/${userId}?year=${statusYear}`,
        );
        setStatusList(response.data);
      } catch (error) {
        if (axios.isAxiosError(error)) {
          toast.error("이수 현황을 불러오지 못했습니다.");
        }
      }
    })();
  }, [userId, statusYear]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl max-h-[85vh] shadow-xl flex flex-col border border-gray-200 dark:border-gray-700">
        {/* 모달 헤더 */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {userName}님의 교육 이수 현황
            </h2>
            <p className="text-base text-gray-500 dark:text-gray-400 mt-1">
              해당 직원의 필수 교육 이수 내역을 확인합니다.
            </p>
          </div>

          {/* 연도 선택 필터 */}
          <Select
            value={statusYear}
            onChange={(e) => setStatusYear(Number(e.target.value))}
            options={yearOptions}
            className="w-28"
          />
        </div>

        {/* 모달 본문 (테이블) */}
        <div className="p-0 flex-1 overflow-hidden overflow-y-auto scrollbar-hide max-h-96">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
              <tr>
                <TableHeader>교육명</TableHeader>
                <TableHeader>마감일</TableHeader>
                <TableHeader>상태</TableHeader>
                <TableHeader>제출일</TableHeader>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {statusList.length > 0 ? (
                statusList.map((status) => (
                  <tr
                    key={status.course_id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <TableRow className="font-bold text-left text-gray-600 dark:text-white">
                      {status.course_name}
                    </TableRow>
                    <TableRow>{formatDateWithDay(status.end_date)}</TableRow>
                    <td className="px-6 py-4 text-center">
                      {<Badge isDone={status.state === 2} />}
                    </td>
                    <TableRow>
                      {status.state === 2 ? (
                        <span>{status.submitted_at?.split(" ")[0]}</span>
                      ) : (
                        <span>-</span>
                      )}
                    </TableRow>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    className="text-center py-6 text-gray-500 dark:text-gray-400"
                  >
                    해당 연도에 등록된 교육 과정이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <FormButton onClick={onClose} className="dark:hover:bg-gray-600">
            닫기
          </FormButton>
        </div>
      </div>
    </div>
  );
};

export default UserStatusModal;
