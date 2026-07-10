import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import bcrypt from "bcryptjs";
import multer from "multer";
import db from "../database.js";
import {
  authenticateToken,
  requireAdmin,
} from "../middlewares/authMiddleware.js";
import { roles } from "../../constants.js";
import { loadUploadedWorksheet } from "../utils/excelUpload.js";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, "../../uploads");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// 유효한 role 값 목록 (1~6)
const VALID_ROLES = Object.values(roles);
const isValidRole = (value) =>
  Number.isInteger(value) && VALID_ROLES.includes(value);

// 모든 요청에 대해 '로그인 + 관리자' 권한 확인
router.use(authenticateToken, requireAdmin);

// GET /api/users : 조회
router.get("/", (req, res) => {
  try {
    // 보안을 위해 비밀번호는 제외하고 조회
    const users = db
      .prepare(
        `SELECT u.id, u.username, u.name, u.department, u.department_id as departmentId,
                u.team, u.team_id as teamId, u.role, u.created_at
         FROM users u
         LEFT JOIN departments d ON u.department_id = d.id
         LEFT JOIN teams t ON u.team_id = t.id
         ORDER BY COALESCE(d.order_index, 9999) ASC,
                  COALESCE(t.order_index, 9999) ASC,
                  u.name ASC`,
      )
      .all();
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

// POST /api/users : 생성
router.post("/", (req, res) => {
  const {
    username,
    password,
    name,
    department,
    departmentId,
    team,
    teamId,
    role,
  } = req.body;

  try {
    const assignedRole = role || 1;
    if (!isValidRole(assignedRole)) {
      return res.status(400).json({ message: "유효하지 않은 권한 값입니다." });
    }
    if (assignedRole >= req.user.role) {
      return res.status(403).json({ message: "권한이 없습니다." });
    }
    if (!password) {
      return res.status(400).json({ message: "비밀번호를 입력해주세요." });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const stmt = db.prepare(`
      INSERT INTO users (username, password, name, department, department_id, team, team_id, role)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      username,
      hashedPassword,
      name,
      department,
      departmentId,
      team,
      teamId,
      assignedRole,
    );

    res.status(201).json({
      message: "사용자가 등록되었습니다.",
      id: result.lastInsertRowid,
    });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(400).json({ message: "이미 존재하는 아이디입니다." });
    }
    if (error.code === "SQLITE_CONSTRAINT_FOREIGNKEY") {
      return res
        .status(400)
        .json({ message: "존재하지 않는 부서 또는 팀입니다." });
    }
    console.error(error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

// DELETE /api/users/reset : 직원 초기화
router.delete("/reset", (req, res) => {
  try {
    const resetProcess = db.transaction(() => {
      const filesToDelete = db
        .prepare(
          `
        SELECT e.stored_file_name 
        FROM enrollments e
        JOIN users u ON e.user_id = u.id
        WHERE u.role IN (${[roles["일반직원"], roles["팀계담당"], roles["부서담당"]].join(", ")}) AND e.stored_file_name IS NOT NULL
      `,
        )
        .all();

      filesToDelete.forEach((file) => {
        if (file.stored_file_name) {
          const filePath = path.join(uploadDir, file.stored_file_name);
          try {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          } catch (error) {
            console.error(
              `[초기화] 파일 삭제 실패: ${file.stored_file_name}`,
              error,
            );
          }
        }
      });

      const result = db
        .prepare(
          `DELETE FROM users WHERE role IN (${[roles["일반직원"], roles["팀계담당"], roles["부서담당"]].join(", ")})`,
        )
        .run();

      return result.changes;
    });

    const deletedCount = resetProcess();

    res.json({
      message: `초기화 완료: 일반 및 팀담당 직원 ${deletedCount}명이 삭제되었습니다.`,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "직원 목록 초기화 중 오류가 발생했습니다." });
  }
});

// DELETE /api/users/:id : 삭제
router.delete("/:id", (req, res) => {
  try {
    const { id } = req.params;
    if (parseInt(id) === req.user.id) {
      return res
        .status(400)
        .json({ message: "자기 자신은 삭제할 수 없습니다." });
    }

    const target = db.prepare("SELECT role FROM users WHERE id = ?").get(id);
    if (!target) {
      return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
    }
    if (target.role >= req.user.role) {
      return res.status(403).json({ message: "권한이 없습니다." });
    }

    const files = db
      .prepare("SELECT stored_file_name FROM enrollments WHERE user_id = ?")
      .all(id);

    db.prepare("DELETE FROM users WHERE id = ?").run(id);

    files.forEach((file) => {
      if (file.stored_file_name) {
        const filePath = path.join(uploadDir, file.stored_file_name);
        try {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch (err) {
          console.error(`파일 삭제 실패 (${file.stored_file_name}):`, err);
        }
      }
    });

    res.json({ message: "사용자가 삭제되었습니다." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

// PUT /api/users/:id : 업데이트
router.put("/:id", (req, res) => {
  const { id } = req.params;
  const { role, password, department, departmentId, team, teamId } = req.body; // 수정할 권한과 비번

  try {
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
    if (!user) {
      return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
    }

    // 동급 이상 권한의 계정은 수정 불가
    if (user.role >= req.user.role) {
      return res.status(403).json({ message: "권한이 없습니다." });
    }

    if (role !== undefined) {
      if (!isValidRole(role)) {
        return res.status(400).json({ message: "유효하지 않은 권한 값입니다." });
      }
      // 요청자 권한 이상의 role로 변경 불가
      if (role >= req.user.role) {
        return res.status(403).json({ message: "권한이 없습니다." });
      }
    }

    // 비밀번호 입력 여부에 따른 분기
    if (password && password.trim() !== "") {
      const hashedPassword = bcrypt.hashSync(password, 10);
      const stmt = db.prepare(
        "UPDATE users SET role = ?, department = ?, department_id = ?, team = ?, team_id = ?, password = ? WHERE id = ?",
      );
      stmt.run(
        role,
        department,
        departmentId,
        team,
        teamId,
        hashedPassword,
        id,
      );
    } else {
      const stmt = db.prepare(
        "UPDATE users SET role = ?, department = ?, department_id = ?, team = ?, team_id = ? WHERE id = ?",
      );
      stmt.run(role, department, departmentId, team, teamId, id);
    }

    res.json({ message: "사용자 정보가 수정되었습니다." });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_FOREIGNKEY") {
      return res
        .status(400)
        .json({ message: "존재하지 않는 부서 또는 팀입니다." });
    }
    console.error(error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

// POST /api/users/upload-excel : 엑셀 일괄 업로드
router.post("/upload-excel", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "파일이 업로드되지 않았습니다." });
  }

  try {
    const worksheet = await loadUploadedWorksheet(req.file);
    if (!worksheet)
      return res.status(400).json({ message: "엑셀 시트를 찾을 수 없습니다." });

    const defaultPasswordHash = bcrypt.hashSync("1234", 10);
    let successCount = 0;
    let failCount = 0;

    const usersData = [];
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;

      const username = String(row.getCell(1).value || "").trim();
      const name = String(row.getCell(2).value || "").trim();
      const department = String(row.getCell(3).value || "").trim();
      const team = String(row.getCell(4).value || "").trim();

      // team은 빈 칸일 수 있다 (과장처럼 특정 팀(계)에 소속되지 않은 직원 → 미지정 처리)
      if (username && name && department) {
        usersData.push({ username, name, department, team });
      }
    });

    if (usersData.length === 0)
      return res
        .status(400)
        .json({ message: "엑셀 파일에 데이터가 없습니다." });

    const insertMany = db.transaction((users) => {
      const stmt = db.prepare(`
        INSERT INTO users (username, password, name, department, department_id, team, team_id, role)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const deptStmt = db.prepare("SELECT id FROM departments WHERE name = ?");
      const teamStmt = db.prepare(
        "SELECT id FROM teams WHERE name = ? AND department_id = ?",
      );

      for (const user of users) {
        try {
          const dept = deptStmt.get(user.department);
          if (!dept) {
            console.error(
              `[엑셀업로드 실패] ${user.username}: 존재하지 않는 부서 "${user.department}"`,
            );
            failCount++;
            continue;
          }

          // team 칸이 비어있으면 미지정(team_id=0)으로 등록한다.
          let teamId = 0;
          let teamName = "";
          if (user.team) {
            const teamRow = teamStmt.get(user.team, dept.id);
            if (!teamRow) {
              console.error(
                `[엑셀업로드 실패] ${user.username}: 존재하지 않는 팀 "${user.team}" (부서: ${user.department})`,
              );
              failCount++;
              continue;
            }
            teamId = teamRow.id;
            teamName = user.team;
          }

          stmt.run(
            user.username,
            defaultPasswordHash,
            user.name,
            user.department,
            dept.id,
            teamName,
            teamId,
            roles["일반직원"],
          );
          successCount++;
        } catch (error) {
          console.error(`[엑셀업로드 실패] ${user.username}: ${error.message}`);
          failCount++;
        }
      }
    });

    insertMany(usersData);

    res.json({
      message: `업로드 완료: 성공 ${successCount}건, 실패(중복 등) ${failCount}건`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "엑셀 처리 중 서버 오류가 발생했습니다." });
  }
});

// POST /api/users/upload-edit-excel : 엑셀 일괄 수정
router.post("/upload-edit-excel", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "파일이 업로드되지 않았습니다." });
  }

  try {
    const worksheet = await loadUploadedWorksheet(req.file);
    if (!worksheet)
      return res.status(400).json({ message: "엑셀 시트를 찾을 수 없습니다." });

    const usersData = [];
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return; // 헤더 행 건너뜀

      const username = String(row.getCell(1).value || "").trim();
      const name = String(row.getCell(2).value || "").trim();
      const department = String(row.getCell(3).value || "").trim();
      const team = String(row.getCell(4).value || "").trim();

      // team은 빈 칸일 수 있다 (과장처럼 특정 팀(계)에 소속되지 않은 직원 → 미지정 처리)
      if (username && name && department) {
        usersData.push({ username, name, department, team });
      }
    });

    if (usersData.length === 0)
      return res
        .status(400)
        .json({ message: "엑셀 파일에 데이터가 없습니다." });

    let successCount = 0;
    let notFoundCount = 0;

    const updateMany = db.transaction((users) => {
      const stmt = db.prepare(`
        UPDATE users
        SET name = ?, department = ?, department_id = ?, team = ?, team_id = ?
        WHERE username = ?
      `);
      const deptStmt = db.prepare("SELECT id FROM departments WHERE name = ?");
      const teamStmt = db.prepare(
        "SELECT id FROM teams WHERE name = ? AND department_id = ?",
      );

      for (const user of users) {
        const dept = deptStmt.get(user.department);
        if (!dept) {
          console.error(
            `[엑셀일괄변경 실패] ${user.username}: 존재하지 않는 부서 "${user.department}"`,
          );
          notFoundCount++;
          continue;
        }

        // team 칸이 비어있으면 미지정(team_id=0)으로 변경한다.
        let teamId = 0;
        let teamName = "";
        if (user.team) {
          const teamRow = teamStmt.get(user.team, dept.id);
          if (!teamRow) {
            console.error(
              `[엑셀일괄변경 실패] ${user.username}: 존재하지 않는 팀 "${user.team}" (부서: ${user.department})`,
            );
            notFoundCount++;
            continue;
          }
          teamId = teamRow.id;
          teamName = user.team;
        }

        const result = stmt.run(
          user.name,
          user.department,
          dept.id,
          teamName,
          teamId,
          user.username,
        );

        if (result.changes > 0) {
          successCount++;
        } else {
          console.warn(`[엑셀일괄변경] 사번 없음: ${user.username}`);
          notFoundCount++;
        }
      }
    });

    updateMany(usersData);

    res.json({
      message: `변경 완료: 성공 ${successCount}건, 사번 미존재 ${notFoundCount}건`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "엑셀 처리 중 서버 오류가 발생했습니다." });
  }
});

export default router;
