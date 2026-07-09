export const roles = {
  시스템관리자: 6,
  총괄담당: 5,
  교육담당: 4,
  부서담당: 3,
  팀계담당: 2,
  일반직원: 1,
};

// 시스템관리자 로그인/접근이 허용되는 사설망 IP 대역 (서버 PC 로컬 접속만 허용)
export const LOCAL_RANGES = [
  "127.0.0.1",
  "::1",
  "::ffff:127.0.0.1",
  "172.16.0.0/12",
];

// 업로드/AI 검증에서 허용하는 파일 확장자의 단일 소스.
// 확장자를 추가/제거할 때는 이 맵만 수정하면 MIME 타입, 매직 바이트,
// multer fileFilter 정규식이 모두 함께 갱신된다.
export const ALLOWED_FILE_TYPES = {
  ".pdf": {
    mime: "application/pdf",
    magicBytes: [0x25, 0x50, 0x44, 0x46],
    label: "PDF",
  },
  ".jpg": {
    mime: "image/jpeg",
    magicBytes: [0xff, 0xd8, 0xff],
    label: "JPEG",
  },
  ".jpeg": {
    mime: "image/jpeg",
    magicBytes: [0xff, 0xd8, 0xff],
    label: "JPEG",
  },
  ".png": {
    mime: "image/png",
    magicBytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    label: "PNG",
  },
};

// 확장자 -> MIME 타입 매핑 (ALLOWED_FILE_TYPES에서 파생)
export const MIME_TYPES = Object.fromEntries(
  Object.entries(ALLOWED_FILE_TYPES).map(([ext, { mime }]) => [ext, mime]),
);

// 업로드 파일명 검사에 쓰는 정규식 (ALLOWED_FILE_TYPES에서 파생)
// 예: /\.(pdf|jpg|jpeg|png)$/i
export const ALLOWED_FILE_EXT_REGEX = new RegExp(
  `\\.(${Object.keys(ALLOWED_FILE_TYPES)
    .map((ext) => ext.slice(1))
    .join("|")})$`,
  "i",
);
