import { useEffect, useState } from "react";
import api from "../api/axios";
import toast from "react-hot-toast";
import FormButton from "./FormButton";
import { getErrorMessage } from "../utils/errorUtils";
import type { PublicFeedback } from "../types";

interface FeedbackModalProps {
  onClose: () => void;
}

const FeedbackModal = ({ onClose }: FeedbackModalProps) => {
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbacks, setFeedbacks] = useState<PublicFeedback[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);

  const loadFeedbacks = async () => {
    setIsLoadingList(true);
    try {
      const response = await api.get("/feedback/public");
      setFeedbacks(response.data);
    } catch (error) {
      toast.error(getErrorMessage(error, "의견 목록을 불러올 수 없습니다."));
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    loadFeedbacks();
  }, []);

  const handleToggleLike = async (id: number) => {
    try {
      const response = await api.post(`/feedback/${id}/like`);
      setFeedbacks((prev) =>
        prev.map((f) =>
          f.id === id
            ? {
                ...f,
                liked_by_me: response.data.liked ? 1 : 0,
                like_count: response.data.like_count,
              }
            : f,
        ),
      );
    } catch (error) {
      toast.error(getErrorMessage(error, "좋아요 처리에 실패했습니다."));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await api.post("/feedback", { content });
      toast.success(response.data.message);
      setContent("");
      loadFeedbacks();
    } catch (error) {
      toast.error(getErrorMessage(error, "의견 등록에 실패했습니다."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl h-[80vh] shadow-xl flex flex-col">
        <div className="p-6 pb-4 shrink-0">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span>✍️</span>
              <span className="border-b-2">의견작성</span>
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              &times;
            </button>
          </div>
          <p className="text-base text-gray-500 dark:text-gray-400 mt-3">
            불편했던 점이나 개선했으면 하는 부분을 자유롭게 남겨주세요.
            좋았던 점을 알려주셔도 좋습니다.
          </p>
        </div>

        {/* 다른 사용자들이 남긴 의견 (작성자 이름 표시) */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 my-4 space-y-5">
          {isLoadingList ? (
            <p className="text-base text-gray-400 text-center py-4">
              불러오는 중...
            </p>
          ) : feedbacks.length > 0 ? (
            feedbacks.map((feedback) => (
              <div key={feedback.id} className="flex items-center gap-3">
                <img
                  src="/brightness.svg"
                  alt="프로필"
                  className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-700 p-1.5 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400">
                    {feedback.user_name ?? "알 수 없음"} · {feedback.created_at}
                  </p>
                  <p className="text-base text-gray-800 dark:text-gray-100 whitespace-pre-wrap break-words">
                    {feedback.content}
                  </p>
                </div>
                <button
                  onClick={() => handleToggleLike(feedback.id)}
                  className={`shrink-0 flex items-center gap-1 text-base px-2 py-1 rounded transition ${
                    feedback.liked_by_me
                      ? "text-red-500"
                      : "text-gray-400 hover:text-red-400"
                  }`}
                >
                  {feedback.liked_by_me ? "❤️" : "🤍"} {feedback.like_count}
                </button>
              </div>
            ))
          ) : (
            <p className="text-base text-gray-400 text-center py-4">
              아직 등록된 의견이 없습니다.
            </p>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 pt-4 space-y-4 shrink-0 border-t border-gray-200 dark:border-gray-700 mt-3"
        >
          <textarea
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full border rounded px-3 py-2 resize-none dark:bg-gray-700 dark:text-white dark:border-gray-600"
            placeholder="의견을 입력해주세요."
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <FormButton onClick={onClose} className="dark:hover:bg-gray-600">
              닫기
            </FormButton>
            <button
              type="submit"
              disabled={isSubmitting || !content.trim()}
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              제출하기
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FeedbackModal;
