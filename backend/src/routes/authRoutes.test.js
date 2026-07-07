import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../app.js";

// database.js가 initDatabase() 시점에 "geadmin" 초기 관리자 계정을
// 자동 생성하므로(패스워드: GongEdu!234), 별도 시딩 없이 바로 로그인 테스트가 가능하다.
describe("POST /api/auth/login", () => {
  it("올바른 계정 정보로 로그인하면 토큰을 반환한다", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ username: "geadmin", password: "GongEdu!234" });

    expect(response.status).toBe(200);
    expect(response.body.token).toBeDefined();
    expect(response.body.user.role).toBe(6); // 시스템관리자
  });

  it("비밀번호가 틀리면 401을 반환한다", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ username: "geadmin", password: "wrong-password" });

    expect(response.status).toBe(401);
  });

  it("존재하지 않는 계정이면 401을 반환한다", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ username: "no-such-user", password: "whatever" });

    expect(response.status).toBe(401);
  });
});

describe("인증이 필요한 라우트", () => {
  it("토큰 없이 요청하면 401을 반환한다", async () => {
    const response = await request(app).get("/api/courses");

    expect(response.status).toBe(401);
  });

  it("유효한 토큰으로 요청하면 200을 반환한다", async () => {
    const loginResponse = await request(app)
      .post("/api/auth/login")
      .send({ username: "geadmin", password: "GongEdu!234" });

    const response = await request(app)
      .get("/api/courses")
      .set("Authorization", `Bearer ${loginResponse.body.token}`);

    expect(response.status).toBe(200);
  });
});
