import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../app.js";
import db from "../database.js";
import { loginAsAdmin, createUser, loginAs } from "../test/helpers.js";

const MINIMAL_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// app.js가 dotenv로 실제 backend/.env를 로드하므로, 로컬 개발용 API 키가 있으면
// 업로드 시 실제 AI 호출이 발생할 수 있다. cleanup 테스트는 업로드 자체만 확인하면
// 되므로 AI 검증은 "키 없음" 경로로 건너뛰도록 강제로 비워둔다.
const AI_ENV_KEYS = ["AI_PROVIDER", "OPENAI_API_KEY", "ANTHROPIC_API_KEY"];
for (const key of AI_ENV_KEYS) delete process.env[key];

describe("설정 화면 접근 권한 (총괄담당 이상)", () => {
  let adminToken;
  let seniorManagerToken;
  let educatorToken;

  beforeAll(async () => {
    adminToken = await loginAsAdmin();
    await createUser(adminToken, {
      username: "senior-mgr-test",
      role: 5, // 총괄담당
    });
    await createUser(adminToken, {
      username: "educator-test",
      role: 4, // 교육담당
    });
    seniorManagerToken = await loginAs("senior-mgr-test");
    educatorToken = await loginAs("educator-test");
  });

  it("교육담당은 GET /api/settings를 호출할 수 없다", async () => {
    const response = await request(app)
      .get("/api/settings")
      .set("Authorization", `Bearer ${educatorToken}`);

    expect(response.status).toBe(403);
  });

  it("총괄담당은 GET /api/settings를 호출할 수 있다", async () => {
    const response = await request(app)
      .get("/api/settings")
      .set("Authorization", `Bearer ${seniorManagerToken}`);

    expect(response.status).toBe(200);
  });

  it("교육담당은 GET /api/settings/ai를 호출할 수 없다", async () => {
    const response = await request(app)
      .get("/api/settings/ai")
      .set("Authorization", `Bearer ${educatorToken}`);

    expect(response.status).toBe(403);
  });

  it("총괄담당은 AI 설정을 저장/조회할 수 있다", async () => {
    const saveResponse = await request(app)
      .post("/api/settings/ai")
      .set("Authorization", `Bearer ${seniorManagerToken}`)
      .send({
        provider: "openai",
        model: "gpt-4o",
        apiKey: "sk-test-secret-value",
      });
    expect(saveResponse.status).toBe(200);

    const getResponse = await request(app)
      .get("/api/settings/ai")
      .set("Authorization", `Bearer ${seniorManagerToken}`);
    expect(getResponse.status).toBe(200);
    // API 키는 원문이 아니라 boolean으로만 노출되어야 한다.
    expect(getResponse.body.hasOpenaiKey).toBe(true);
    expect(getResponse.body.openaiApiKey).toBeUndefined();
  });

  it("GET /api/settings는 저장된 AI API 키 원문을 노출하지 않는다", async () => {
    // 위 테스트에서 openaiApiKey를 저장해둔 상태.
    const response = await request(app)
      .get("/api/settings")
      .set("Authorization", `Bearer ${seniorManagerToken}`);

    expect(response.status).toBe(200);
    const values = Object.values(response.body);
    expect(response.body.ai_openai_api_key).toBeUndefined();
    expect(values).not.toContain("sk-test-secret-value");
  });

  it("교육담당은 DELETE /api/settings/cleanup을 호출할 수 없다", async () => {
    const response = await request(app)
      .delete("/api/settings/cleanup")
      .set("Authorization", `Bearer ${educatorToken}`)
      .send({ year: 2020, mode: "files_only" });

    expect(response.status).toBe(403);
  });

  it("files_only 모드는 지정 연도 파일만 지우고 이수 기록은 유지한다", async () => {
    const courseRes = await request(app)
      .post("/api/courses")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        year: 2020,
        name: "정리 테스트 교육",
        end_date: "2020-12-31",
        detail: "",
        department_id: 0,
      });
    const courseId = courseRes.body.id;

    await request(app)
      .post(`/api/enrollments/${courseId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("file", MINIMAL_PNG, "cert.png");

    const before = db
      .prepare("SELECT id, stored_file_name FROM enrollments WHERE course_id = ?")
      .get(courseId);
    expect(before.stored_file_name).not.toBeNull();

    const response = await request(app)
      .delete("/api/settings/cleanup")
      .set("Authorization", `Bearer ${seniorManagerToken}`)
      .send({ year: 2020, mode: "files_only" });

    expect(response.status).toBe(200);

    const after = db
      .prepare("SELECT id, stored_file_name FROM enrollments WHERE id = ?")
      .get(before.id);
    expect(after).toBeDefined();
    expect(after.stored_file_name).toBeNull();

    const course = db.prepare("SELECT id FROM courses WHERE id = ?").get(courseId);
    expect(course).toBeDefined();
  });

  it("all 모드는 지정 연도의 교육과정과 이수 기록을 모두 삭제한다", async () => {
    const courseRes = await request(app)
      .post("/api/courses")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        year: 2021,
        name: "전체 삭제 테스트 교육",
        end_date: "2021-12-31",
        detail: "",
        department_id: 0,
      });
    const courseId = courseRes.body.id;

    await request(app)
      .post(`/api/enrollments/${courseId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("file", MINIMAL_PNG, "cert.png");

    const response = await request(app)
      .delete("/api/settings/cleanup")
      .set("Authorization", `Bearer ${seniorManagerToken}`)
      .send({ year: 2021, mode: "all" });

    expect(response.status).toBe(200);

    const course = db.prepare("SELECT id FROM courses WHERE id = ?").get(courseId);
    expect(course).toBeUndefined();

    const remainingEnrollments = db
      .prepare("SELECT id FROM enrollments WHERE course_id = ?")
      .all(courseId);
    expect(remainingEnrollments).toHaveLength(0);
  });
});
