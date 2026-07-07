import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../app.js";
import db from "../database.js";

// app.js가 dotenv로 실제 backend/.env를 로드하므로, 로컬 개발용으로 설정된
// 실제 API 키가 있다면 테스트에서도 그대로 보여 실제 AI 호출이 발생할 수 있다.
// "키가 없는 상황"을 확실하게 재현하기 위해 테스트 동안에는 강제로 비워둔다.
const AI_ENV_KEYS = ["AI_PROVIDER", "OPENAI_API_KEY", "ANTHROPIC_API_KEY"];
const originalAiEnv = Object.fromEntries(
  AI_ENV_KEYS.map((key) => [key, process.env[key]]),
);

// PNG 매직 바이트만 있으면 업로드 검증은 통과한다.
// 테스트 환경(vitest.config.js)에는 OPENAI_API_KEY/ANTHROPIC_API_KEY가 설정되어 있지 않으므로
// 실제 AI 호출 없이 "missing_api_key" 경로를 그대로 검증할 수 있다.
const MINIMAL_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

async function loginAsAdmin() {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ username: "geadmin", password: "GongEdu!234" });
  return res.body.token;
}

describe("AI 검증 API 키 미설정 안내", () => {
  let token;
  let courseId;

  beforeAll(async () => {
    for (const key of AI_ENV_KEYS) delete process.env[key];

    token = await loginAsAdmin();

    const courseRes = await request(app)
      .post("/api/courses")
      .set("Authorization", `Bearer ${token}`)
      .send({
        year: 2026,
        name: "AI 검증 테스트 교육",
        end_date: "2026-12-31",
        detail: "",
        department_id: 0,
      });
    courseId = courseRes.body.id;
  });

  it("API 키가 없으면 업로드 응답에 missing_api_key 사유를 포함한다", async () => {
    const response = await request(app)
      .post(`/api/enrollments/${courseId}`)
      .set("Authorization", `Bearer ${token}`)
      .attach("file", MINIMAL_PNG, "cert.png");

    expect(response.status).toBe(200);
    expect(response.body.aiSkipReason).toBe("missing_api_key");
  });

  it("재검증 응답도 같은 사유를 반환하고 미검증 상태로 남긴다", async () => {
    const enrollment = db
      .prepare(
        `SELECT e.id FROM enrollments e
         JOIN users u ON u.id = e.user_id
         WHERE e.course_id = ? AND u.username = 'geadmin'`,
      )
      .get(courseId);

    const response = await request(app)
      .post(`/api/enrollments/${enrollment.id}/reverify`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.ai_verified).toBe(false);
    expect(response.body.aiSkipReason).toBe("missing_api_key");
  });

  afterAll(() => {
    for (const key of AI_ENV_KEYS) {
      if (originalAiEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalAiEnv[key];
    }
  });
});
