import { useEffect, useState } from "react";
import api from "../api/axios";
import toast from "react-hot-toast";
import type { Feedback } from "../types";
import ScrollableTextarea from "../components/ScrollableTextarea";
import TableHeader from "../components/TableHeader";
import TableRow from "../components/TableRow";
import { getErrorMessage } from "../utils/errorUtils";

const FeedbackAdminPage = () => {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showUncheckedOnly, setShowUncheckedOnly] = useState(false);
  const [editingReplyId, setEditingReplyId] = useState<number | null>(null);
  const [replyDraft, setReplyDraft] = useState("");

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

  const handleDelete = async (id: number) => {
    if (!confirm("이 의견을 삭제하시겠습니까? (일반 사용자에게만 숨겨집니다)"))
      return;
    try {
      await api.delete(`/feedback/${id}`);
      setFeedbacks((prev) =>
        prev.map((f) => (f.id === id ? { ...f, deleted: 1 } : f)),
      );
    } catch (error) {
      toast.error(getErrorMessage(error, "의견 삭제에 실패했습니다."));
    }
  };

  const handlePermanentDelete = async (id: number) => {
    if (
      !confirm(
        "이 의견을 완전히 삭제하시겠습니까?\n삭제 후에는 복구할 수 없습니다.",
      )
    )
      return;
    try {
      await api.delete(`/feedback/${id}/permanent`);
      setFeedbacks((prev) => prev.filter((f) => f.id !== id));
    } catch (error) {
      toast.error(getErrorMessage(error, "완전 삭제에 실패했습니다."));
    }
  };

  const startReplyEdit = (feedback: Feedback) => {
    setEditingReplyId(feedback.id);
    setReplyDraft(feedback.reply_content ?? "");
  };

  const cancelReplyEdit = () => {
    setEditingReplyId(null);
    setReplyDraft("");
  };

  const handleSaveReply = async (id: number) => {
    try {
      await api.patch(`/feedback/${id}/reply`, { reply: replyDraft });
      const response = await api.get("/feedback");
      setFeedbacks(response.data);
      cancelReplyEdit();
    } catch (error) {
      toast.error(getErrorMessage(error, "답장 저장에 실패했습니다."));
    }
  };

  const handleDeleteReply = async (id: number) => {
    if (!confirm("답장을 삭제하시겠습니까?")) return;
    try {
      await api.patch(`/feedback/${id}/reply`, { reply: "" });
      setFeedbacks((prev) =>
        prev.map((f) =>
          f.id === id
            ? { ...f, reply_content: null, reply_by_name: null, replied_at: null }
            : f,
        ),
      );
    } catch (error) {
      toast.error(getErrorMessage(error, "답장 삭제에 실패했습니다."));
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
              <TableHeader className="min-w-18 whitespace-nowrap">
                확인
              </TableHeader>
              <TableHeader className="min-w-42 whitespace-nowrap">
                제출일
              </TableHeader>
              <TableHeader className="min-w-18 whitespace-nowrap">
                제출자
              </TableHeader>
              <TableHeader className="min-w-18 whitespace-nowrap">
                부서
              </TableHeader>
              <TableHeader className="min-w-18 whitespace-nowrap">
                상태
              </TableHeader>
              <TableHeader className="min-w-18 text-left">
                내용
              </TableHeader>
              <TableHeader className="min-w-18 text-left">
                답장
              </TableHeader>
              <TableHeader className="min-w-18 whitespace-nowrap">
                관리
              </TableHeader>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {isLoading ? (
              <tr>
                <TableRow colSpan={8}>불러오는 중...</TableRow>
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
                  <TableRow className="whitespace-pre-line">
                    {feedback.created_at.replace(" ", "\n")}
                  </TableRow>
                  <TableRow className="whitespace-nowrap">
                    {feedback.user_name ?? "-"}
                  </TableRow>
                  <TableRow className="whitespace-nowrap">
                    {feedback.department ?? "-"}
                  </TableRow>
                  <TableRow className="whitespace-nowrap">
                    {feedback.deleted === 1 ? (
                      <span className="text-red-500">삭제됨</span>
                    ) : (
                      "-"
                    )}
                  </TableRow>
                  <TableRow className="text-left whitespace-pre-wrap">
                    {feedback.content}
                  </TableRow>
                  <TableRow className="text-left min-w-[220px]">
                    {editingReplyId === feedback.id ? (
                      <div className="space-y-1.5">
                        <ScrollableTextarea
                          rows={3}
                          value={replyDraft}
                          onChange={(e) => setReplyDraft(e.target.value)}
                          className="w-full border rounded px-2 py-1 text-sm resize-none dark:bg-gray-700 dark:text-white dark:border-gray-600"
                          placeholder="답장을 입력하세요."
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveReply(feedback.id)}
                            className="text-sm text-indigo-600 hover:text-indigo-700"
                          >
                            저장
                          </button>
                          <button
                            onClick={cancelReplyEdit}
                            className="text-sm text-gray-400 hover:text-gray-600"
                          >
                            취소
                          </button>
                        </div>
                      </div>
                    ) : feedback.reply_content ? (
                      <div className="space-y-1">
                        <p className="text-sm whitespace-pre-wrap">
                          {feedback.reply_content}
                        </p>
                        <p className="text-xs text-gray-400">
                          {feedback.reply_by_name} · {feedback.replied_at}
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => startReplyEdit(feedback)}
                            className="text-sm text-indigo-600 hover:text-indigo-700"
                          >
                            수정
                          </button>
                          <button
                            onClick={() => handleDeleteReply(feedback.id)}
                            className="text-sm text-red-500 hover:text-red-600"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => startReplyEdit(feedback)}
                        className="text-sm text-indigo-600 hover:text-indigo-700"
                      >
                        답장 작성
                      </button>
                    )}
                  </TableRow>
                  <TableRow className="whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {feedback.deleted === 1 ? null : (
                        <button
                          onClick={() => handleDelete(feedback.id)}
                          className="text-sm text-red-500 hover:text-red-600"
                        >
                          삭제
                        </button>
                      )}
                      <button
                        onClick={() => handlePermanentDelete(feedback.id)}
                        className="text-sm text-red-700 hover:text-red-800"
                      >
                        완전삭제
                      </button>
                    </div>
                  </TableRow>
                </tr>
              ))
            ) : (
              <tr>
                <TableRow colSpan={8}>등록된 의견이 없습니다.</TableRow>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FeedbackAdminPage;
