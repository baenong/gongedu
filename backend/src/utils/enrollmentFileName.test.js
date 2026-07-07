import { describe, expect, it } from "vitest";
import { buildDisplayFileName, sanitizeFilename } from "./enrollmentFileName.js";

describe("sanitizeFilename", () => {
  it("파일명에 쓸 수 없는 특수문자를 제거한다", () => {
    expect(sanitizeFilename('총무과/팀:계*?"<>|')).toBe("총무과팀계");
  });

  it("앞뒤 공백을 제거한다", () => {
    expect(sanitizeFilename("  총무과  ")).toBe("총무과");
  });
});

describe("buildDisplayFileName", () => {
  it("부서/교육명/팀/이름/확장자를 정해진 형식으로 조합한다", () => {
    const result = buildDisplayFileName({
      department: "총무과",
      team: "총무계",
      name: "홍길동",
      courseName: "청렴교육",
      ext: ".pdf",
    });

    expect(result).toBe("[총무과] 청렴교육_총무계_홍길동.pdf");
  });

  it("특수문자가 섞인 값도 정리한 뒤 조합한다", () => {
    const result = buildDisplayFileName({
      department: "총무과",
      team: "총무/계",
      name: "홍*길동",
      courseName: "청렴:교육",
      ext: ".jpg",
    });

    expect(result).toBe("[총무과] 청렴교육_총무계_홍길동.jpg");
  });
});
