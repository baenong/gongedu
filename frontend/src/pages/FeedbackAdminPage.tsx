import { useEffect, useState } from "react";
import api from "../api/axios";
import toast from "react-hot-toast";
import type { Feedback } from "../types";
import TableHeader from "../components/TableHeader";
import TableRow from "../components/TableRow";
import { getErrorMessage } from "../utils/errorUtils";

const FeedbackAdminPage = () => {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showUncheckedOnly, setShowUncheckedOnly] = useState(false);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const response = await api.get("/feedback");
        setFeedbacks(response.data);
      } catch (error) {
        toast.error(getErrorMessage(error, "의견 목록을 불러올 수 없습니다."));
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const handleToggleChecked = async (id: number, checked: boolean) => {
    try {
      await api.patch(`/feedback/${id}/checked`, { checked });
      setFeedbacks((prev) =>
        prev.map((f) => (f.id === id ? { ...f, checked: checked ? 1 : 0 } : f)),
      );
    } catch (error) {
      toast.error(getErrorMessage(error, "확인 상태 변경에 실패했습니다."));
    }
  };

  const visibleFeedbacks = showUncheckedOnly
    ? feedbacks.filter((f) => f.checked === 0)
    : feedbacks;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          기능개선 의견
        </h1>
        <label className="flex items-center gap-2 text-base text-gray-600 dark:text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={showUncheckedOnly}
            onChange={(e) => setShowUncheckedOnly(e.target.checked)}
          />
          미확인만 보기
        </label>
      </div>

      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <TableHeader>확인</TableHeader>
              <TableHeader>제출일</TableHeader>
              <TableHeader>제출자</TableHeader>
              <TableHeader>부서</TableHeader>
              <TableHeader className="text-left">내용</TableHeader>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {isLoading ? (
              <tr>
                <TableRow colSpan={5}>불러오는 중...</TableRow>
              </tr>
            ) : visibleFeedbacks.length > 0 ? (
              visibleFeedbacks.map((feedback) => (
                <tr key={feedback.id}>
                  <TableRow>
                    <input
                      type="checkbox"
                      checked={feedback.checked === 1}
                      onChange={(e) =>
                        handleToggleChecked(feedback.id, e.target.checked)
                      }
                    />
                  </TableRow>
                  <TableRow className="whitespace-nowrap">
                    {feedback.created_at}
                  </TableRow>
                  <TableRow className="whitespace-nowrap">
                    {feedback.user_name ?? "-"}
                  </TableRow>
                  <TableRow className="whitespace-nowrap">
                    {feedback.department ?? "-"}
                  </TableRow>
                  <TableRow className="text-left whitespace-pre-wrap">
                    {feedback.content}
                  </TableRow>
                </tr>
              ))
            ) : (
              <tr>
                <TableRow colSpan={5}>등록된 의견이 없습니다.</TableRow>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FeedbackAdminPage;
