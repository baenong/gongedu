import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../app.js";
import db from "../database.js";
import { loginAsAdmin, createUser, loginAs } from "../test/helpers.js";

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

describe("GET /status/user/:userId 접근 범위", () => {
  let adminToken;
  let educatorAToken;
  let educatorBToken;
  let deptManagerAToken;
  let seniorManagerToken;
  let targetUserId;
  let courseXId; // educatorA가 등록, 부서A 소속
  let courseYId; // educatorB가 등록, 부서B 소속

  async function createDepartment(name) {
    const res = await request(app)
      .post("/api/departments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name, orderIndex: 1 });
    return res.body.id;
  }

  async function createCourseAs(token, name) {
    const res = await request(app)
      .post("/api/courses")
      .set("Authorization", `Bearer ${token}`)
      .send({ year: 2026, name, end_date: "2026-12-31", detail: "" });
    return res.body.id;
  }

  beforeAll(async () => {
    adminToken = await loginAsAdmin();

    const deptAId = await createDepartment("스코프테스트-부서A");
    const deptBId = await createDepartment("스코프테스트-부서B");

    await createUser(adminToken, {
      username: "scope-educator-a",
      role: 4,
      departmentId: deptAId,
    });
    await createUser(adminToken, {
      username: "scope-educator-b",
      role: 4,
      departmentId: deptBId,
    });
    await createUser(adminToken, {
      username: "scope-deptmgr-a",
      role: 3,
      departmentId: deptAId,
    });
    await createUser(adminToken, {
      username: "scope-senior",
      role: 5,
    });
    targetUserId = await createUser(adminToken, {
      username: "scope-target",
      role: 1,
      departmentId: deptAId,
    });

    educatorAToken = await loginAs("scope-educator-a");
    educatorBToken = await loginAs("scope-educator-b");
    deptManagerAToken = await loginAs("scope-deptmgr-a");
    seniorManagerToken = await loginAs("scope-senior");

    // 교육담당이 만든 과정은 자동으로 본인 부서로 귀속된다(courseRoutes.js).
    courseXId = await createCourseAs(educatorAToken, "스코프테스트-과정X");
    courseYId = await createCourseAs(educatorBToken, "스코프테스트-과정Y");
  });

  function courseIdsIn(response) {
    return response.body.map((row) => row.course_id);
  }

  it("교육담당은 본인이 등록한 과정만 볼 수 있다", async () => {
    const response = await request(app)
      .get(`/api/enrollments/status/user/${targetUserId}`)
      .set("Authorization", `Bearer ${educatorAToken}`);

    expect(response.status).toBe(200);
    const ids = courseIdsIn(response);
    expect(ids).toContain(courseXId);
    expect(ids).not.toContain(courseYId);
  });

  it("다른 교육담당이 등록한 과정은 보이지 않는다", async () => {
    const response = await request(app)
      .get(`/api/enrollments/status/user/${targetUserId}`)
      .set("Authorization", `Bearer ${educatorBToken}`);

    expect(response.status).toBe(200);
    const ids = courseIdsIn(response);
    expect(ids).toContain(courseYId);
    expect(ids).not.toContain(courseXId);
  });

  // 이 라우트는 requireAdmin(교육담당 이상)으로 막혀 있어, 부서담당/팀계담당은
  // canAccessEnrollment 필터에 도달하기도 전에 403을 받는다. "/admin/users" 화면
  // 자체가 교육담당 이상만 접근 가능하므로(router.tsx) 프런트 접근 범위와도 일치한다.
  it("부서담당은 애초에 이 엔드포인트를 호출할 수 없다", async () => {
    const response = await request(app)
      .get(`/api/enrollments/status/user/${targetUserId}`)
      .set("Authorization", `Bearer ${deptManagerAToken}`);

    expect(response.status).toBe(403);
  });

  it("본인 조회는 과정 작성자와 무관하게 항상 전부 보인다", async () => {
    const educatorAUser = await request(app)
      .post("/api/auth/login")
      .send({ username: "scope-educator-a", password: "Password!234" });

    const response = await request(app)
      .get(`/api/enrollments/status/user/${educatorAUser.body.user.id}`)
      .set("Authorization", `Bearer ${educatorAToken}`);

    expect(response.status).toBe(200);
    const ids = courseIdsIn(response);
    expect(ids).toContain(courseXId);
    expect(ids).toContain(courseYId);
  });

  it("총괄담당 이상은 과정 작성자/부서와 무관하게 전부 볼 수 있다", async () => {
    const response = await request(app)
      .get(`/api/enrollments/status/user/${targetUserId}`)
      .set("Authorization", `Bearer ${seniorManagerToken}`);

    expect(response.status).toBe(200);
    const ids = courseIdsIn(response);
    expect(ids).toContain(courseXId);
    expect(ids).toContain(courseYId);
  });
});

describe("수료증 재제출 시 중복 등록 방지", () => {
  let adminToken;
  let courseId;

  beforeAll(async () => {
    adminToken = await loginAsAdmin();
    const courseRes = await request(app)
      .post("/api/courses")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        year: 2026,
        name: "재제출 테스트 교육",
        end_date: "2026-12-31",
        detail: "",
        department_id: 0,
      });
    courseId = courseRes.body.id;
  });

  it("같은 과정에 두 번 제출해도 enrollments 행이 하나만 유지된다", async () => {
    const first = await request(app)
      .post(`/api/enrollments/${courseId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("file", MINIMAL_PNG, "cert1.png");
    expect(first.status).toBe(200);

    const second = await request(app)
      .post(`/api/enrollments/${courseId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("file", MINIMAL_PNG, "cert2.png");
    expect(second.status).toBe(200);

    const rows = db
      .prepare(
        `SELECT e.id, e.stored_file_name FROM enrollments e
         JOIN users u ON u.id = e.user_id
         WHERE e.course_id = ? AND u.username = 'geadmin'`,
      )
      .all(courseId);

    expect(rows).toHaveLength(1);
  });
});

describe("GET /course/:courseId 제출대상 범위 (총괄담당 이상 제외)", () => {
  let adminToken;
  let courseId;
  let educatorId;
  let seniorManagerId;

  beforeAll(async () => {
    adminToken = await loginAsAdmin();

    educatorId = await createUser(adminToken, {
      username: "headcount-educator",
      role: 4,
    });
    seniorManagerId = await createUser(adminToken, {
      username: "headcount-senior",
      role: 5,
    });

    const courseRes = await request(app)
      .post("/api/courses")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        year: 2026,
        name: "제출대상 범위 테스트 교육",
        end_date: "2026-12-31",
        detail: "",
        department_id: 0,
      });
    courseId = courseRes.body.id;
  });

  it("상세 제출현황 목록에는 교육담당은 포함되고 총괄담당은 빠진다", async () => {
    const response = await request(app)
      .get(`/api/enrollments/course/${courseId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    const userIds = response.body.map((row) => row.user_id);
    expect(userIds).toContain(educatorId);
    expect(userIds).not.toContain(seniorManagerId);
  });

  it("교육과정 목록의 total_count(전체 대상 인원)에도 총괄담당은 포함되지 않는다", async () => {
    const before = await request(app)
      .get("/api/courses?year=2026")
      .set("Authorization", `Bearer ${adminToken}`);
    const totalCountBefore = before.body.find(
      (c) => c.id === courseId,
    ).total_count;

    // 총괄담당을 한 명 더 만들어도 total_count는 그대로여야 한다.
    await createUser(adminToken, { username: "headcount-senior-2", role: 5 });

    const after = await request(app)
      .get("/api/courses?year=2026")
      .set("Authorization", `Bearer ${adminToken}`);
    const totalCountAfter = after.body.find((c) => c.id === courseId).total_count;

    expect(totalCountAfter).toBe(totalCountBefore);
  });
});
