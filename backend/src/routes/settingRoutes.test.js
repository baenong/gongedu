import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../app.js";
import { loginAsAdmin, createUser, loginAs } from "../test/helpers.js";

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
        openaiModel: "gpt-4o",
        anthropicModel: "",
        openaiApiKey: "sk-test-secret-value",
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
});
