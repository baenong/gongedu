import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { roles } from "./constants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// backend/constants.js와 frontend/src/utils/constants.ts는 런타임이 분리되어 있어
// 같은 변수를 물리적으로 공유할 수 없다. 대신 값이 어긋나면 이 테스트가 실패해
// 두 파일을 함께 고치도록 강제한다.
const parseRolesObject = (source) => {
  const match = source.match(/export const roles = {([^}]*)}/);
  if (!match) throw new Error("roles 선언을 찾을 수 없습니다.");

  const entries = [...match[1].matchAll(/([^\s:,]+)\s*:\s*(\d+)/g)].map(
    ([, key, value]) => [key, Number(value)],
  );
  return Object.fromEntries(entries);
};

describe("roles 상수 동기화", () => {
  it("frontend/src/utils/constants.ts의 roles 값이 backend/constants.js와 일치해야 한다", () => {
    const frontendPath = path.join(
      __dirname,
      "../frontend/src/utils/constants.ts",
    );
    const frontendSource = fs.readFileSync(frontendPath, "utf-8");
    const frontendRoles = parseRolesObject(frontendSource);

    expect(frontendRoles).toEqual(roles);
  });
});
