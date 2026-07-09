import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import db from "../database.js";
import {
  authenticateToken,
  requireAdmin,
} from "../middlewares/authMiddleware.js";
import { roles } from "../../constants.js";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, "../../uploads");

// 교육 과정 목록 조회 : arguments는 조회 연도 추가(확장성 고려)
// GET /api/courses
// ?year=2025
router.get("/", authenticateToken, (req, res) => {
  try {
    const { year } = req.query;
    const { role, departmentId, teamId, id: userId } = req.user;

    let userCondition = `u.role < ${roles["총괄담당"]}`;
    let enrollmentCondition = `u.role < ${roles["총괄담당"]}`;

    // 파라미터 배열
    let params = [];

    if (role === roles["교육담당"]) {
      params.push(userId, userId);
    }

    if (role === roles["부서담당"]) {
      userCondition += " AND u.department_id = ?";
      enrollmentCondition += " AND u.department_id = ?";
      params.push(departmentId, departmentId);
    }

    if (role === roles["팀계담당"]) {
      userCondition += " AND u.team_id = ?";
      enrollmentCondition += " AND u.team_id = ?";
      params.push(teamId, teamId);
    }

    // 1. 전체 대상 인원 / 2. 제출 완료 인원 계산식
    let totalCountExpr = `(SELECT COUNT(*) FROM users u WHERE ${userCondition})`;
    let submittedCountExpr = `(SELECT COUNT(*)
         FROM enrollments e
         JOIN users u ON e.user_id = u.id
         WHERE e.course_id = c.id AND e.state = 2 AND ${enrollmentCondition}
        )`;

    // 교육담당(4)은 본인이 만든 과정에 한해서만 인원 수를 노출
    if (role === roles["교육담당"]) {
      totalCountExpr = `CASE WHEN c.created_by = ? THEN ${totalCountExpr} ELSE NULL END`;
      submittedCountExpr = `CASE WHEN c.created_by = ? THEN ${submittedCountExpr} ELSE NULL END`;
    }

    let query = `
      SELECT
        c.*,
        d.name as department,
        ${totalCountExpr} as total_count,
        ${submittedCountExpr} as submitted_count
      FROM courses c
      LEFT JOIN departments d ON d.id = c.department_id
    `;

    // 연도가 지정되면 해당 연도만 조회, 없으면 전체 조회 (또는 현재 연도)
    if (year) {
      query += " WHERE c.year = ?";
      params.push(year);
    }

    query += " ORDER BY end_date ASC"; // 마감일 순 정렬

    const courses = db.prepare(query).all(...params);
    res.json(courses);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

// (관리자용) 교육 과정 등록
// POST /api/courses
router.post("/", authenticateToken, requireAdmin, (req, res) => {
  const { year, name, end_date, detail } = req.body;

  // 교육담당은 본인 부서로 강제 지정, 총괄담당 이상은 요청 값을 그대로 사용
  const department_id =
    req.user.role === roles["교육담당"]
      ? req.user.departmentId
      : (req.body.department_id ?? 0);

  // courses.department_id는 DB 레벨 FK가 없어 잘못된 값이 조용히 저장될 수 있으므로 직접 검증
  if (department_id) {
    const dept = db
      .prepare("SELECT id FROM departments WHERE id = ?")
      .get(department_id);
    if (!dept) {
      return res.status(400).json({ message: "존재하지 않는 부서입니다." });
    }
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO courses (year, name, end_date, detail, created_by, department_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      year,
      name,
      end_date,
      detail,
      req.user.id,
      department_id,
    );

    res.status(201).json({
      message: "교육 과정이 등록되었습니다.",
      id: result.lastInsertRowid,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

// (관리자용) 교육 과정 삭제
// DELETE /api/courses/:id
router.delete("/:id", authenticateToken, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const course = db.prepare("SELECT * FROM courses WHERE id = ?").get(id);

    if (!course) {
      return res.status(404).json({ message: "교육 과정을 찾을 수 없습니다." });
    }

    // 교육담당은 본인 소유만 삭제 가능
    if (
      req.user.role === roles["교육담당"] &&
      course.created_by !== req.user.id
    ) {
      return res
        .status(403)
        .json({ message: "본인이 등록한 교육과정만 삭제할 수 있습니다." });
    }

    const files = db
      .prepare("SELECT stored_file_name FROM enrollments WHERE course_id = ?")
      .all(id);

    files.forEach((file) => {
      if (file.stored_file_name) {
        const filePath = path.join(uploadDir, file.stored_file_name);
        try {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch (e) {
          console.error(`파일 삭제 실패: ${file.stored_file_name}`, e);
        }
      }
    });

    db.prepare("DELETE FROM courses WHERE id = ?").run(id);

    res.json({ message: "교육 과정이 삭제되었습니다." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

// (관리자용) 교육 과정 변경
// PUT /api/courses/:id
router.put("/:id", authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { end_date, detail } = req.body;

  try {
    const course = db.prepare("SELECT * FROM courses WHERE id = ?").get(id);

    // 교육과정이 없다면 에러
    if (!course) {
      return res.status(404).json({ message: "교육과정을 찾을 수 없습니다." });
    }

    // 교육담당이라면 본인이 만든 교육과정만 수정가능
    if (
      req.user.role === roles["교육담당"] &&
      course.created_by !== req.user.id
    ) {
      return res
        .status(403)
        .json({ message: "본인이 등록한 교육과정만 수정할 수 있습니다." });
    }

    // 주관부서 수정은 총괄담당 이상만 가능, 그 외 역할은 기존 값 유지
    const department_id =
      req.user.role >= roles["총괄담당"]
        ? (req.body.department_id ?? course.department_id)
        : course.department_id;

    // courses.department_id는 DB 레벨 FK가 없어 잘못된 값이 조용히 저장될 수 있으므로 직접 검증
    if (department_id) {
      const dept = db
        .prepare("SELECT id FROM departments WHERE id = ?")
        .get(department_id);
      if (!dept) {
        return res.status(400).json({ message: "존재하지 않는 부서입니다." });
      }
    }

    const stmt = db.prepare(
      "UPDATE courses SET end_date = ?, detail = ?, department_id = ? WHERE id = ?",
    );
    stmt.run(end_date, detail, department_id, id);

    res.json({ message: "교육과정 정보가 수정되었습니다." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

export default router;
