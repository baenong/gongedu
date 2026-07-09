import { useState } from "react";
import api from "../api/axios";
import { getErrorMessage } from "../utils/errorUtils";
import toast from "react-hot-toast";
import FormLabel from "./FormLabel";

const DataCleanupSettings = () => {
  const [cleanupYear, setCleanupYear] = useState(new Date().getFullYear() - 1); // 기본값: 작년
  const [cleanupMode, setCleanupMode] = useState<"files_only" | "all">(
    "files_only",
  );

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

  return (
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
  );
};

export default DataCleanupSettings;
