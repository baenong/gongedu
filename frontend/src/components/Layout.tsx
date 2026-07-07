import { useState, useEffect } from "react";
import { Outlet, useNavigate, Link } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useThemeStore } from "../store/themeStore";
import api from "../api/axios";
import FormLabel from "./FormLabel";
import TextInput from "./TextInput";
import toast, { Toaster } from "react-hot-toast";
import HelpModal from "./HelpModal";
import FeedbackModal from "./FeedbackModal";
import { getErrorMessage } from "../utils/errorUtils";
import { roles } from "../utils/constants";
import icoLogout from "../assets/icon/ico_logout.svg";

const Layout = () => {
  const { user, logout } = useAuthStore();
  const { isDarkMode, toggleTheme } = useThemeStore();
  const navigate = useNavigate();

  const [showPwdModal, setShowPwdModal] = useState(false);
  const [pwdForm, setPwdForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [showHelp, setShowHelp] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  const roleIcons = ["👤", "🛡️", "⭐", "📚", "👑", "🔝"];

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  const handleLogout = () => {
    logout(); // 스토어 초기화
    navigate("/login");
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      toast.error("새 비밀번호가 일치하지 않습니다.");
      return;
    }

    try {
      await api.put("/auth/password", {
        currentPassword: pwdForm.currentPassword,
        newPassword: pwdForm.newPassword,
      });
      toast.success("비밀번호가 변경되었습니다. 다시 로그인해주세요.");
      setShowPwdModal(false);
      handleLogout(); // 보안을 위해 변경 후 로그아웃 처리
    } catch (error) {
      toast.error(getErrorMessage(error, "비밀번호 변경 실패"));
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden transition-colors duration-700">
      <Toaster
        position="top-center"
        reverseOrder={false}
        toastOptions={{
          style: {
            borderRadius: "8px",
            background: "#333",
            color: "#fff",
          },
          success: {
            style: {
              background: "#059669",
              color: "white",
            },
          },
          error: {
            style: {
              background: "#DC2626",
              color: "white",
            },
          },
        }}
      />

      {/* 상단 네비게이션 바 */}
      <header className="sticky top-0 z-40 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 transition-colors duration-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* 로고 / 홈 버튼 */}

            <Link
              to="/"
              className="text-2xl font-bold text-indigo-600 dark:text-indigo-300"
            >
              <img
                src={isDarkMode ? "/logo-white.svg" : "/logo.svg"}
                className="h-16"
              />
            </Link>

            <button
              onClick={() => setShowFeedback(true)}
              className={`fixed bottom-28 right-12
                        bg-emerald-600 hover:bg-emerald-700 text-white
                          p-4 rounded-full shadow-lg hover:shadow-xl
                          opacity-30 hover:opacity-100
                          transition-all z-50 flex items-center justify-center group`}
              title="의견작성"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                />
              </svg>
            </button>

            <button
              onClick={() => setShowHelp(true)}
              className={`fixed bottom-12 right-12
                        bg-indigo-600 hover:bg-indigo-700 text-white
                          p-4 rounded-full shadow-lg hover:shadow-xl
                          opacity-30 hover:opacity-100
                          transition-all z-50 flex items-center justify-center group`}
              title="사용 가이드"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
                />
              </svg>
            </button>

            {/* 우측 메뉴 */}
            <div className="flex items-center gap-2 min-[500px]:gap-4">
              <button
                onClick={toggleTheme}
                className="relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors overflow-hidden w-10 h-10 flex items-center justify-center group"
                title={isDarkMode ? "라이트 모드로 변경" : "다크 모드로 변경"}
              >
                <span
                  className={`absolute transition-all duration-700 ease-in-out transform 
                    ${
                      isDarkMode
                        ? "-translate-x-10 opacity-0 -rotate-90"
                        : "translate-x-0 opacity-100 rotate-0"
                    }`}
                >
                  ☀️
                </span>

                <span
                  className={`absolute transition-all duration-700 ease-in-out transform 
                    ${
                      isDarkMode
                        ? "translate-x-0 opacity-100 rotate-0"
                        : "translate-x-10 opacity-0 rotate-90"
                    }`}
                >
                  🌙
                </span>
              </button>

              {user && (
                <>
                  <button
                    onClick={() => {
                      setPwdForm({
                        currentPassword: "",
                        newPassword: "",
                        confirmPassword: "",
                      }); // 초기화
                      setShowPwdModal(true);
                    }}
                    className="text-base text-gray-600 dark:text-gray-300 hidden min-[600px]:inline "
                    title="비밀번호 변경"
                  >
                    <span className="font-semibold text-gray-800 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition">
                      {user.name}
                    </span>
                    님 ({user.team})
                  </button>
                  <span title="권한">{roleIcons[user.role - 1]}</span>

                  {/* 관리자 메뉴 링크 추가 */}
                  {user.role > roles["부서담당"] && (
                    <div className="flex items-center gap-3 border-l border-gray-300 dark:border-gray-600 pl-4 ml-2">
                      <Link
                        to="/admin/users"
                        className="text-base font-medium text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                      >
                        직원관리
                      </Link>
                      <Link
                        to="/admin/settings"
                        className="text-base font-medium text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                      >
                        설정
                      </Link>
                      {user.role === roles["시스템관리자"] && (
                        <Link
                          to="/admin/feedback"
                          className="text-base font-medium text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                        >
                          기능개선 의견
                        </Link>
                      )}
                    </div>
                  )}

                  <button
                    onClick={handleLogout}
                    title="로그아웃"
                    className="ml-2 flex items-center justify-center bg-gray-100 dark:bg-indigo-100 hover:bg-gray-200 dark:hover:bg-indigo-200 text-gray-700 px-3 py-1.5 rounded-md transition"
                  >
                    <img
                      src={icoLogout}
                      alt="로그아웃"
                      className="w-5 h-5 min-[500px]:hidden"
                    />
                    <span className="hidden min-[500px]:inline text-base">
                      로그아웃
                    </span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 실제 페이지 내용이 들어가는 곳 */}
      <main className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 h-full">
          <Outlet />
        </div>
      </main>

      {/* --- 비밀번호 변경 모달 --- */}
      {showPwdModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-sm shadow-xl border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">
              🔒 비밀번호 변경
            </h2>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <FormLabel>현재 비밀번호</FormLabel>
                <TextInput
                  type="password"
                  value={pwdForm.currentPassword}
                  onChange={(e) =>
                    setPwdForm({ ...pwdForm, currentPassword: e.target.value })
                  }
                />
              </div>
              <hr className="dark:border-gray-700" />
              <div>
                <FormLabel>새 비밀번호</FormLabel>
                <TextInput
                  type="password"
                  value={pwdForm.newPassword}
                  onChange={(e) =>
                    setPwdForm({ ...pwdForm, newPassword: e.target.value })
                  }
                />
              </div>
              <div>
                <FormLabel>새 비밀번호 확인</FormLabel>
                <TextInput
                  type="password"
                  className={
                    pwdForm.newPassword &&
                    pwdForm.confirmPassword &&
                    pwdForm.newPassword !== pwdForm.confirmPassword
                      ? "border-red-500"
                      : "dark:border-gray-600"
                  }
                  value={pwdForm.confirmPassword}
                  onChange={(e) =>
                    setPwdForm({ ...pwdForm, confirmPassword: e.target.value })
                  }
                />
                {pwdForm.newPassword &&
                  pwdForm.confirmPassword &&
                  pwdForm.newPassword !== pwdForm.confirmPassword && (
                    <p className="text-sm text-red-500 mt-1">
                      비밀번호가 일치하지 않습니다.
                    </p>
                  )}
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setShowPwdModal(false)}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-white rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                >
                  변경하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- 도움말 모달 --- */}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

      {/* --- 의견작성 모달 --- */}
      {showFeedback && (
        <FeedbackModal onClose={() => setShowFeedback(false)} />
      )}
    </div>
  );
};

export default Layout;
