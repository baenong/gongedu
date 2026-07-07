import { createBrowserRouter } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import MainPage from "./pages/MainPage";
import AdminUserPage from "./pages/AdminUserPage";
import SettingPage from "./pages/SettingPage";
import FeedbackAdminPage from "./pages/FeedbackAdminPage";
import ErrorPage from "./pages/ErrorPage";
import { roles } from "./utils/constants";

const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
    errorElement: <ErrorPage />,
  },
  {
    path: "/",
    element: <Layout />, // 상단 헤더 포함
    errorElement: <ErrorPage />,
    children: [
      // 로그인한 사용자만 접근 가능
      {
        element: <ProtectedRoute />,
        children: [
          { index: true, element: <MainPage /> }, // 메인(교육목록)
        ],
      },
      // 관리자만 접근 가능 (Admin Route)
      {
        path: "admin",
        element: <ProtectedRoute requireAdmin={true} />,
        children: [
          { path: "users", element: <AdminUserPage /> },
          { path: "settings", element: <SettingPage /> },
        ],
      },
      // 시스템관리자만 접근 가능
      {
        path: "admin",
        element: (
          <ProtectedRoute requireAdmin={true} minRole={roles["시스템관리자"]} />
        ),
        children: [{ path: "feedback", element: <FeedbackAdminPage /> }],
      },
    ],
  },
]);

export default router;
