import { useState } from "react";
import api from "../api/axios";
import toast from "react-hot-toast";
import FormButton from "./FormButton";
import { getErrorMessage } from "../utils/errorUtils";

interface FeedbackModalProps {
  onClose: () => void;
}

const FeedbackModal = ({ onClose }: FeedbackModalProps) => {
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await api.post("/feedback", { content });
      toast.success(response.data.message);
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error, "의견 등록에 실패했습니다."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-lg shadow-xl flex flex-col">
        <div className="p-6 flex justify-between items-center">
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

        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
          <p className="text-base text-gray-500 dark:text-gray-400">
            불편했던 점이나 개선했으면 하는 부분을 자유롭게 남겨주세요.
            좋았던 점을 알려주셔도 좋습니다.
          </p>
          <textarea
            rows={6}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full border rounded px-3 py-2 resize-none dark:bg-gray-700 dark:text-white dark:border-gray-600"
            placeholder="의견을 입력해주세요."
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <FormButton onClick={onClose} className="dark:hover:bg-gray-600">
              취소
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
