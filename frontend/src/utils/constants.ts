export const roles = {
  시스템관리자: 6,
  총괄담당: 5,
  교육담당: 4,
  부서담당: 3,
  팀계담당: 2,
  일반직원: 1,
};

// role 값 -> 아이콘/라벨 표시 정보의 단일 소스.
// 셀렉트 옵션 목록, 목록 아이콘 등은 모두 이 맵에서 파생시킨다.
export const ROLE_META: Record<number, { icon: string; label: string }> = {
  [roles["일반직원"]]: { icon: "👤", label: "일반직원" },
  [roles["팀계담당"]]: { icon: "🛡️", label: "팀계담당" },
  [roles["부서담당"]]: { icon: "⭐", label: "부서담당" },
  [roles["교육담당"]]: { icon: "📚", label: "교육담당" },
  [roles["총괄담당"]]: { icon: "👑", label: "총괄담당" },
  [roles["시스템관리자"]]: { icon: "🔝", label: "시스템관리자" },
};

export const getRoleLabel = (role: number) => {
  const meta = ROLE_META[role] ?? ROLE_META[roles["일반직원"]];
  return `${meta.icon} ${meta.label}`;
};

// 수료증 업로드 <input accept>에 쓰는 허용 확장자.
// 백엔드 backend/constants.js의 ALLOWED_FILE_TYPES와 맞춰 유지한다.
export const CERTIFICATE_FILE_ACCEPT = ".pdf,.jpg,.jpeg,.png";
