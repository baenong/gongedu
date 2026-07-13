import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../app.js";
import { loginAsAdmin, createUser, loginAs } from "../test/helpers.js";

describe("기능개선 의견 관리 화면 접근 권한 (총괄담당 이상)", () => {
  let adminToken;
  let seniorManagerToken;
  let educatorToken;
  let otherEducatorToken;
  let feedbackId;

  beforeAll(async () => {
    adminToken = await loginAsAdmin();
    await createUser(adminToken, { username: "fb-senior-test", role: 5 });
    await createUser(adminToken, { username: "fb-educator-test", role: 4 });
    await createUser(adminToken, { username: "fb-educator-test2", role: 4 });
    seniorManagerToken = await loginAs("fb-senior-test");
    educatorToken = await loginAs("fb-educator-test");
    otherEducatorToken = await loginAs("fb-educator-test2");

    const uniqueContent = `테스트 의견입니다 ${Date.now()}`;
    await request(app)
      .post("/api/feedback")
      .set("Authorization", `Bearer ${educatorToken}`)
      .send({ content: uniqueContent });

    const list = await request(app)
      .get("/api/feedback")
      .set("Authorization", `Bearer ${seniorManagerToken}`);
    feedbackId = list.body.find((f) => f.content === uniqueContent)?.id;
  });

  it("누구나 의견을 작성할 수 있다", async () => {
    const response = await request(app)
      .post("/api/feedback")
      .set("Authorization", `Bearer ${educatorToken}`)
      .send({ content: "또 다른 의견입니다." });

    expect(response.status).toBe(201);
  });

  it("교육담당은 의견 목록(GET /)을 조회할 수 없다", async () => {
    const response = await request(app)
      .get("/api/feedback")
      .set("Authorization", `Bearer ${educatorToken}`);

    expect(response.status).toBe(403);
  });

  it("총괄담당은 의견 목록(GET /)을 조회할 수 있다", async () => {
    const response = await request(app)
      .get("/api/feedback")
      .set("Authorization", `Bearer ${seniorManagerToken}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  it("교육담당은 확인 여부를 토글할 수 없다", async () => {
    const response = await request(app)
      .patch(`/api/feedback/${feedbackId}/checked`)
      .set("Authorization", `Bearer ${educatorToken}`)
      .send({ checked: true });

    expect(response.status).toBe(403);
  });

  it("총괄담당은 확인 여부를 토글할 수 있다", async () => {
    const response = await request(app)
      .patch(`/api/feedback/${feedbackId}/checked`)
      .set("Authorization", `Bearer ${seniorManagerToken}`)
      .send({ checked: true });

    expect(response.status).toBe(200);
  });

  it("공개 목록(/public)은 작성자 이름은 노출하고 부서는 노출하지 않는다", async () => {
    const response = await request(app)
      .get("/api/feedback/public")
      .set("Authorization", `Bearer ${educatorToken}`);

    expect(response.status).toBe(200);
    for (const feedback of response.body) {
      expect(feedback).toHaveProperty("user_name");
      expect(feedback).not.toHaveProperty("department");
    }
  });

  it("공개 목록(/public)은 본인이 작성한 의견에 is_mine=true를 표시한다", async () => {
    const response = await request(app)
      .get("/api/feedback/public")
      .set("Authorization", `Bearer ${educatorToken}`);

    const mine = response.body.find((f) => f.id === feedbackId);
    expect(mine.is_mine).toBeTruthy();

    const seniorView = await request(app)
      .get("/api/feedback/public")
      .set("Authorization", `Bearer ${seniorManagerToken}`);
    const notMine = seniorView.body.find((f) => f.id === feedbackId);
    expect(notMine.is_mine).toBeFalsy();
  });

  it("총괄담당 미만이 타인이 작성한 의견을 삭제할 수 없다", async () => {
    const response = await request(app)
      .delete(`/api/feedback/${feedbackId}`)
      .set("Authorization", `Bearer ${otherEducatorToken}`);

    expect(response.status).toBe(403);
  });

  it("총괄담당은 타인이 작성한 의견도 삭제(숨김 처리)할 수 있다", async () => {
    const uniqueContent = `총괄담당 삭제 테스트 ${Date.now()}`;
    await request(app)
      .post("/api/feedback")
      .set("Authorization", `Bearer ${educatorToken}`)
      .send({ content: uniqueContent });

    const list = await request(app)
      .get("/api/feedback")
      .set("Authorization", `Bearer ${seniorManagerToken}`);
    const targetId = list.body.find((f) => f.content === uniqueContent)?.id;

    const response = await request(app)
      .delete(`/api/feedback/${targetId}`)
      .set("Authorization", `Bearer ${seniorManagerToken}`);

    expect(response.status).toBe(200);

    const publicList = await request(app)
      .get("/api/feedback/public")
      .set("Authorization", `Bearer ${educatorToken}`);
    expect(publicList.body.find((f) => f.id === targetId)).toBeUndefined();
  });

  it("본인이 작성한 의견은 삭제할 수 있다 (숨김 처리, 관리자 이력에는 남음)", async () => {
    const response = await request(app)
      .delete(`/api/feedback/${feedbackId}`)
      .set("Authorization", `Bearer ${educatorToken}`);

    expect(response.status).toBe(200);

    const publicList = await request(app)
      .get("/api/feedback/public")
      .set("Authorization", `Bearer ${educatorToken}`);
    expect(
      publicList.body.find((f) => f.id === feedbackId),
    ).toBeUndefined();

    const adminList = await request(app)
      .get("/api/feedback")
      .set("Authorization", `Bearer ${seniorManagerToken}`);
    const deletedFeedback = adminList.body.find((f) => f.id === feedbackId);
    expect(deletedFeedback).toBeDefined();
    expect(deletedFeedback.deleted).toBe(1);
  });

  it("총괄담당 미만은 완전삭제(DELETE /:id/permanent)를 할 수 없다", async () => {
    const response = await request(app)
      .delete(`/api/feedback/${feedbackId}/permanent`)
      .set("Authorization", `Bearer ${educatorToken}`);

    expect(response.status).toBe(403);
  });

  it("총괄담당은 완전삭제를 할 수 있고, 삭제 후 관리자 목록에서도 사라진다", async () => {
    const response = await request(app)
      .delete(`/api/feedback/${feedbackId}/permanent`)
      .set("Authorization", `Bearer ${seniorManagerToken}`);

    expect(response.status).toBe(200);

    const adminList = await request(app)
      .get("/api/feedback")
      .set("Authorization", `Bearer ${seniorManagerToken}`);
    expect(adminList.body.find((f) => f.id === feedbackId)).toBeUndefined();
  });
});
