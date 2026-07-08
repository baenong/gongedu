import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import toast from "react-hot-toast";
import { roles } from "../utils/constants";

// 이 컴포넌트를 포함해 프론트엔드의 role 체크는 전부 UX(화면 노출 여부)용이다.
// 실제 권한 게이트는 백엔드가 각 라우트에서 독립적으로 재검증한다.
// 예: courseRoutes.js의 requireAdmin + 소유권 체크, enrollmentRoutes.js의
// canAccessEnrollment/checkProxyEnrollmentPermission. 프론트에서 버튼을 숨기지
// 못하더라도 서버가 최종 방어선이므로, 여기 로직에 구멍이 있어도 데이터 접근
// 자체는 막힌다 — 다만 회귀 발생 시 UX만 깨질 뿐 조용히 넘어가지 않도록 주의.
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
