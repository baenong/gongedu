import db from "../database.js";

// DB의 settings 테이블에서 값을 조회한다. 값이 없으면(빈 문자열 포함) null을 반환해
// 호출부에서 `getSetting(key) || process.env.X` 형태로 .env 폴백을 구성할 수 있다.
export function getSetting(key) {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return row?.value || null;
}
