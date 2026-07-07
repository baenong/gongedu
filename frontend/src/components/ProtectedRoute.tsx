import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import toast from "react-hot-toast";
import { roles } from "../utils/constants";

interface Props {
  requireAdmin?: boolean; // 관리자 권한 필요 여부
  minRole?: number; // 지정 시 requireAdmin의 기본 기준(교육담당) 대신 이 값을 최소 권한으로 사용
}

const ProtectedRoute = ({ requireAdmin = false, minRole }: Props) => {
  const { user, token } = useAuthStore();

  if (!token || !user) return <Navigate to="/login" replace />;

  // 관리자 권한이 필요한 페이지 접근하는 경우
  if (requireAdmin && user.role < (minRole ?? roles["교육담당"])) {
    toast.error("접근 권한이 없습니다.");
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
