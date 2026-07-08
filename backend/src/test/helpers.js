import request from "supertest";
import app from "../app.js";

// database.js가 initDatabase() 시점에 자동 생성하는 초기 관리자 계정
// (username: geadmin, password: GongEdu!234, role: 시스템관리자)으로 로그인한다.
export async function loginAsAdmin() {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ username: "geadmin", password: "GongEdu!234" });
  return res.body.token;
}

// adminToken(자신보다 낮은 role만 생성 가능)으로 테스트용 계정을 만든다.
export async function createUser(
  adminToken,
  { username, role, departmentId = 0, teamId = 0, password = "Password!234" },
) {
  const res = await request(app)
    .post("/api/users")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      username,
      password,
      name: username,
      department: "",
      departmentId,
      team: "",
      teamId,
      role,
    });
  return res.body.id;
}

export async function loginAs(username, password = "Password!234") {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ username, password });
  return res.body.token;
}
