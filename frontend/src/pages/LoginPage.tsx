import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import axios from "axios";
import { useAuthStore } from "../store/authStore";
import { getErrorMessage } from "../utils/errorUtils";
import FormLabel from "../components/FormLabel";
import TextInput from "../components/TextInput";

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuthStore();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await api.post("/auth/login", { username, password });
      const { user, token } = response.data;
      login(user, token);
      navigate("/");
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        setError("아이디 또는 비밀번호가 일치하지 않습니다.");
      } else {
        setError(
          getErrorMessage(
            err,
            "서버 접속 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
          ),
        );
      }
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col justify-center items-center p-4 transition-colors duration-200">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden transition-colors duration-200">
        {/* 헤더 섹션 */}
        <div className="flex flex-col items-center bg-indigo-600 p-4 text-center">
          <img
            src="/logo-white.svg"
            alt="logo"
            className="h-32 object-contain mb-5"
          />
          <p className="text-indigo-100 text-base px-8">
            매년 계속 증가하고 있는 필수이수교육들의 이수여부,
            <br /> 수료증을 효율적으로 관리하기 위한 프로그램입니다.
          </p>
        </div>

        {/* 폼 섹션 */}
        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 아이디 입력 */}
            <div>
              <FormLabel htmlFor="username">ID (고유식별번호)</FormLabel>
              <TextInput
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="아이디를 입력하세요"
              />
            </div>

            {/* 비밀번호 입력 */}
            <div>
              <FormLabel htmlFor="password">비밀번호</FormLabel>
              <TextInput
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요"
              />
            </div>

            {/* 에러 메시지 */}
            {error && (
              <div className="bg-red-50 text-red-600 text-base p-3 rounded-md border border-red-200 text-center">
                {error}
              </div>
            )}

            {/* 로그인 버튼 */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3 px-4 border border-transparent rounded-md shadow-sm text-white font-medium bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition
                ${
                  isLoading ? "opacity-70 cursor-not-allowed" : "cursor-pointer"
                }
              `}
            >
              {isLoading ? "로그인 중..." : "로그인"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              계정이 없으신 경우 관리자에게 문의하여 계정을 생성해주세요.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 text-center text-gray-500 text-xs">
        GONG EDU &copy; 전북특별자치도 군산시 안민수
      </div>
    </div>
  );
};

export default LoginPage;
