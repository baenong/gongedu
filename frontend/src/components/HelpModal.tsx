import { useState } from "react";
import HelpText from "./HelpText";
import { useAuthStore } from "../store/authStore";
import { roles } from "../utils/constants";

interface HelpModalProps {
  onClose: () => void;
}

const HelpModal = ({ onClose }: HelpModalProps) => {
  const [activeTab, setActiveTab] = useState<"user" | "admin">("user");

  const user = useAuthStore((state) => state.user);
  const isAdmin = user && user.role > roles["팀계담당"];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl shadow-xl flex flex-col max-h-[80vh]">
        {/* 헤더 */}
        <div className="p-6  flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2 ">
            <span>💡</span>
            <span className="border-b-2">사용 가이드</span>
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            &times;
          </button>
        </div>

        {/* 탭 메뉴 */}
        {isAdmin && (
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <button
              className={`flex-1 py-3 text-base font-medium transition ${
                activeTab === "user"
                  ? "border-b-2 border-indigo-400 text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setActiveTab("user")}
            >
              👤 직원용 가이드
            </button>

            <button
              className={`flex-1 py-3 text-base font-medium transition ${
                activeTab === "admin"
                  ? "border-b-2 border-indigo-400 text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => setActiveTab("admin")}
            >
              🛡️ 관리자용 가이드
            </button>
          </div>
        )}

        {/* 내용 (스크롤 가능) */}
        <div className="p-6 overflow-y-auto leading-relaxed text-gray-700 dark:text-gray-300 space-y-8">
          {activeTab === "user" ? (
            <>
              <HelpText title="1. 수료증 제출하기">
                <p>
                  메인 화면에서{" "}
                  <span className="text-indigo-400 font-bold">
                    [수료증 업로드]
                  </span>{" "}
                  버튼을 클릭하여 PDF 또는 이미지 파일을 제출할 수 있습니다.
                  제출 후에는 관리자 승인 없이 즉시 '제출 완료' 상태가 됩니다.
                </p>
              </HelpText>

              <HelpText title="2. 내 수료증 확인/수정">
                <p>
                  제출된 카드의{" "}
                  <span className="text-indigo-400 font-bold">
                    [내 수료증 다운]
                  </span>{" "}
                  버튼을 통해 제출한 파일을 확인할 수 있으며,{" "}
                  <span className="text-indigo-400 font-bold">[수정]</span>{" "}
                  버튼으로 파일을 다시 올릴 수 있습니다.
                </p>
              </HelpText>
            </>
          ) : (
            <>
              <HelpText title="1. 교육과정 등록">
                <p>
                  화면 우측 상단의{" "}
                  <span className="text-indigo-400 font-bold">
                    [+ 교육과정 등록]
                  </span>{" "}
                  버튼을 눌러 새로운 교육을 개설할 수 있습니다.
                </p>
              </HelpText>

              <HelpText title="2. 이수 현황 확인">
                <p>
                  교육과정 카드를 클릭하면 상세현황을 볼 수 있습니다. 여기서
                  미이수자 명단을 확인하고 직원별, 팀별 이수현황을 볼 수
                  있습니다.
                </p>
              </HelpText>

              <HelpText title="3. 수료증 일괄 다운로드">
                <p>
                  상세 현황판 우측 상단의{" "}
                  <span className="text-indigo-400 font-bold">
                    [📦 수료증 ZIP]
                  </span>{" "}
                  버튼을 누르면, 제출된 수료증을 압축해서 한 번에 다운로드할 수
                  있습니다.
                </p>
              </HelpText>

              <HelpText title="4. 직원관리">
                <p>
                  인사이동 등으로 인해 직원 변화가 있는 경우{" "}
                  <span className="text-indigo-400 font-bold">
                    [+ 사용자 등록]
                  </span>{" "}
                  또는{" "}
                  <span className="text-green-600 font-bold">
                    [📂 엑셀 일괄등록]
                  </span>{" "}
                  버튼을 눌러 신규 사용자를 추가할 수 있습니다. ID는 동명이인을
                  구분하기 위한 각 직원별 고유한 값입니다.
                </p>
              </HelpText>

              <HelpText title="5. 설정">
                <p>
                  조직개편으로 과 이름이 바뀌었거나 부서 IP 대역이 바뀌는 등의
                  일이 아니면 보통은 사용할 일이 없습니다. 가끔 수료증 보관
                  용량이 부족한 경우 파일을 정리할 수 있습니다.
                </p>
              </HelpText>
            </>
          )}
        </div>

        {/* 하단 닫기 */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-white rounded hover:bg-gray-200 hover:cursor-pointer dark:hover:bg-gray-500"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;
