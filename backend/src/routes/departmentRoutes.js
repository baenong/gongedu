import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import express from "express";
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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// 이미 존재하는 정렬번호인지 체크하는 함수
const checkOrderIndex = (orderIndex, id = -1) => {
  let sql = "SELECT id FROM departments WHERE order_index = ?";
  if (id > 0) sql += " AND id != ?";

  const stmt = db.prepare(sql);
  const existing = id > 0 ? stmt.get(orderIndex, id) : stmt.get(orderIndex);

  if (existing) return true;
  else return false;
};

/***
 * 부서 관련 API
 * - 부서 목록 조회
 * - 부서 생성
 * - 부서 상세 조회 (부서 정보 + 해당 부서의 팀 목록)
 * - 부서 수정
 * - 부서 삭제
 */

// GET     /api/departments : 부서 목록 조회
router.get("/", authenticateToken, (req, res) => {
  try {
    const departments = db
      .prepare(
        `
        SELECT id, name, order_index as orderIndex 
        FROM departments 
        ORDER BY order_index ASC
        `,
      )
      .all();
    res.json(departments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

// GET     /api/departments/teams : 팀 목록 전체 조회
router.get("/teams", authenticateToken, (req, res) => {
  try {
    const teams = db
      .prepare(
        `
        SELECT id, name, order_index as orderIndex, department_id as departmentId 
        FROM teams 
        ORDER BY order_index ASC
        `,
      )
      .all();
    res.json(teams);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

// GET     /api/departments/:id : 부서 상세 조회
router.get("/:id", authenticateToken, (req, res) => {
  const { id } = req.params;

  const teamData = [];

  try {
    const dept = db.prepare("SELECT * FROM departments WHERE id = ?").get(id);
    if (!dept) {
      return res.status(404).json({ message: "부서를 찾을 수 없습니다." });
    }

    const teams = db
      .prepare(
        "SELECT id, name, order_index as orderIndex FROM teams WHERE department_id = ?",
      )
      .all(id);

    teams.forEach((team) => {
      teamData.push(team);
    });

    const deptData = {
      name: dept.name,
      teams: teamData,
    };

    res.json(deptData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

// POST    /api/departments : 부서 생성
router.post("/", authenticateToken, requireAdmin, (req, res) => {
  const { name, orderIndex } = req.body;
  try {
    const stmt = db.prepare(`
            INSERT INTO departments (name, order_index)
            VALUES (?, ?)
        `);
    const result = stmt.run(name, orderIndex);
    res.status(201).json({
      message: "부서가 생성되었습니다.",
      id: result.lastInsertRowid,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

// POST    /api/departments/teams : 팀 생성
router.post("/teams", authenticateToken, requireAdmin, (req, res) => {
  const { name, orderIndex, departmentId } = req.body;
  try {
    const stmt = db.prepare(`
            INSERT INTO teams (name, order_index, department_id)
            VALUES (?, ?, ?)
        `);
    const result = stmt.run(name, orderIndex, departmentId);
    res.status(201).json({
      message: "팀/계가 생성되었습니다.",
      id: result.lastInsertRowid,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

// POST    /api/departments/upload-excel : 부서 정보가 담긴 엑셀 파일 업로드하여 일괄 등록/수정
router.post(
  "/upload-excel",
  authenticateToken,
  requireAdmin,
  upload.single("file"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "파일이 업로드되지 않았습니다." });
    }

    try {
      const worksheet = await loadUploadedWorksheet(req.file);
      if (!worksheet)
        return res
          .status(400)
          .json({ message: "엑셀 시트를 찾을 수 없습니다." });

      let successCount = 0;
      let failCount = 0;

      const deptData = [];
      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return;

        const name = String(row.getCell(1).value || "").trim();
        const orderIndex = parseInt(row.getCell(2).value);

        if (name && !isNaN(orderIndex)) {
          deptData.push({ name, orderIndex });
        }
      });

      if (deptData.length === 0)
        return res
          .status(400)
          .json({ message: "엑셀 파일에 유효한 데이터가 없습니다." });

      const insertMany = db.transaction((departments) => {
        const insertStmt = db.prepare(
          `INSERT INTO departments (name, order_index) VALUES (?, ?)`,
        );

        const updateStmt = db.prepare(
          `UPDATE departments SET order_index = ? WHERE id = ?`,
        );

        for (const dept of departments) {
          const existing = db
            .prepare("SELECT id FROM departments WHERE name = ?")
            .get(dept.name);

          try {
            if (existing) {
              // 해당 index가 이미 존재한다면 업로드할 수 없다.
              // 바뀌지 않았다면 굳이 변경할 필요도 없으니 검증 param으로 id를 보내지 않는다.
              if (!checkOrderIndex(dept.orderIndex, existing.id))
                updateStmt.run(dept.orderIndex, existing.id);
              else {
                console.error(`[엑셀업로드 실패] ${dept.name}: 중복된 Index`);
                failCount++;
                continue;
              }
            } else {
              insertStmt.run(dept.name, dept.orderIndex);
            }
            successCount++;
          } catch (error) {
            console.error(`[엑셀업로드 실패] ${dept.name}: ${error.message}`);
            failCount++;
          }
        }
      });

      insertMany(deptData);

      res.json({
        message: `업로드 완료: 성공 ${successCount}건, 실패(중복 등) ${failCount}건`,
      });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ message: "엑셀 처리 중 서버 오류가 발생했습니다." });
    }
  },
);

// POST    /api/departments/teams/upload-excel : 팀 일괄 등록/수정
router.post(
  "/teams/upload-excel",
  authenticateToken,
  requireAdmin,
  upload.single("file"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "파일이 업로드되지 않았습니다." });
    }

    try {
      const worksheet = await loadUploadedWorksheet(req.file);
      if (!worksheet)
        return res
          .status(400)
          .json({ message: "엑셀 시트를 찾을 수 없습니다." });

      let successCount = 0;
      let failCount = 0;

      const teamsData = [];
      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return;

        const name = String(row.getCell(1).value ?? "").trim();
        const orderIndex = Number(row.getCell(2).value);
        const departmentName = String(row.getCell(3).value ?? "").trim();

        console.log(
          `[팀업로드 파싱] row${rowNumber}: name="${name}", orderIndex=${orderIndex}, department="${departmentName}"`,
        );

        if (name && !isNaN(orderIndex) && orderIndex > 0 && departmentName) {
          teamsData.push({ name, orderIndex, departmentName });
        }
      });

      if (teamsData.length === 0)
        return res
          .status(400)
          .json({ message: "엑셀 파일에 유효한 데이터가 없습니다." });

      const upsertMany = db.transaction((teams) => {
        const insertStmt = db.prepare(
          `INSERT INTO teams (name, order_index, department_id) VALUES ($name, $orderIndex, $departmentId)`,
        );
        const updateStmt = db.prepare(
          `UPDATE teams SET order_index = ? WHERE id = ?`,
        );

        for (const team of teams) {
          // 부서명으로 ID 조회
          const dept = db
            .prepare("SELECT id FROM departments WHERE name = ?")
            .get(team.departmentName);
          if (!dept) {
            console.error(
              `[팀업로드 실패] ${team.name}: 존재하지 않는 부서명(${team.departmentName})`,
            );
            failCount++;
            continue;
          }
          const departmentId = dept.id;

          const existing = db
            .prepare(
              "SELECT id, order_index FROM teams WHERE name = ? AND department_id = ?",
            )
            .get(team.name, departmentId);

          try {
            if (existing) {
              // orderIndex 동일 → 변경 없음
              if (existing.order_index === team.orderIndex) {
                successCount++;
                continue;
              }
              // 동일 부서 내 orderIndex 중복 체크 (자기 자신 제외)
              const conflict = db
                .prepare(
                  "SELECT id FROM teams WHERE department_id = ? AND order_index = ? AND id != ?",
                )
                .get(departmentId, team.orderIndex, existing.id);
              if (conflict) {
                console.error(`[팀업로드 실패] ${team.name}: 중복된 Index`);
                failCount++;
                continue;
              }
              updateStmt.run(team.orderIndex, existing.id);
            } else {
              // 신규 INSERT 전 동일 부서 내 orderIndex 중복 체크
              const indexConflict = db
                .prepare(
                  "SELECT id FROM teams WHERE department_id = ? AND order_index = ?",
                )
                .get(departmentId, team.orderIndex);
              if (indexConflict) {
                console.error(`[팀업로드 실패] ${team.name}: 중복된 Index`);
                failCount++;
                continue;
              }
              console.log(
                `[팀업로드 INSERT] name="${team.name}", order_index=${team.orderIndex}, department_id=${departmentId}`,
              );
              insertStmt.run({
                name: team.name,
                orderIndex: team.orderIndex,
                departmentId,
              });
            }
            successCount++;
          } catch (error) {
            console.error(`[팀업로드 실패] ${team.name}: ${error.message}`);
            failCount++;
          }
        }
      });

      upsertMany(teamsData);

      res.json({
        message: `업로드 완료: 성공 ${successCount}건, 실패(중복 등) ${failCount}건`,
      });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ message: "엑셀 처리 중 서버 오류가 발생했습니다." });
    }
  },
);

// PUT     /api/departments/teams/:id : 팀 변경 (/api/departments/:id보다 앞에 둬야 정상 작동)
router.put("/teams/:id", authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { name, orderIndex, departmentId } = req.body;
  try {
    // 해당 팀이 존재하는지 확인
    const team = db.prepare("SELECT * FROM teams WHERE id = ?").get(id);
    if (!team) {
      return res.status(404).json({ message: "팀/계를 찾을 수 없습니다." });
    }

    // 부서 내 팀이 중복되는지 확인 (자기 자신은 제외)
    const existingName = db
      .prepare(
        "SELECT id FROM teams WHERE department_id = ? AND name = ? AND id != ?",
      )
      .get(departmentId, name, id);

    if (existingName) {
      return res.status(400).json({ message: "중복된 팀 이름입니다." });
    }

    // 부서 내 인덱스가 중복되는지 확인
    const existingIdx = db
      .prepare(
        "SELECT id FROM teams WHERE department_id = ? AND order_index = ? AND id != ?",
      )
      .get(departmentId, orderIndex, id);

    if (existingIdx) {
      return res.status(400).json({ message: "중복된 인덱스입니다." });
    }

    // 업데이트 실행
    const stmt = db.prepare(`
            UPDATE teams
            SET name = ?, order_index = ?
            WHERE id = ?
        `);

    stmt.run(name, orderIndex, id);

    res.json({ message: "팀/계가 수정되었습니다." });

    // 변경 실시
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

// PUT     /api/departments/:id : 부서 수정
router.put("/:id", authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { name, orderIndex } = req.body;
  try {
    // id에 해당하는 부서가 있는지 체크
    const dept = db.prepare("SELECT * FROM departments WHERE id = ?").get(id);
    if (!dept) {
      return res.status(404).json({ message: "부서를 찾을 수 없습니다." });
    }

    // 이름이 중복되는지 체크 (자기 자신은 제외)
    const existingName = db
      .prepare("SELECT id FROM departments WHERE name = ? AND id != ?")
      .get(name, id);

    if (existingName) {
      return res.status(400).json({ message: "중복된 부서 이름입니다." });
    }

    // 이미 있는 order_index인지 체크 (자기 자신은 제외)
    if (checkOrderIndex(orderIndex, id)) {
      return res.status(400).json({ message: "중복된 정렬 번호입니다." });
    }

    // 업데이트 실행
    const stmt = db.prepare(`
            UPDATE departments
            SET name = ?, order_index = ?
            WHERE id = ?
        `);

    stmt.run(name, orderIndex, id);

    res.json({ message: "부서가 수정되었습니다." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

// DELETE /api/departments/teams/reset : 팀 전체 초기화
router.delete("/teams/reset", authenticateToken, requireAdmin, (req, res) => {
  try {
    const resetTeams = db.transaction(() => {
      // 1. 모든 사용자의 팀 참조 초기화 + 팀계담당 권한 일반직원으로 초기화
      db.prepare(
        `
        UPDATE users
        SET team_id = 0, team = '',
            role = CASE WHEN role = ${roles["팀계담당"]} THEN ${roles["일반직원"]} ELSE role END
      `,
      ).run();

      // 2. 팀 전체 삭제 (id=0 기본값 행 보호)
      const result = db.prepare("DELETE FROM teams WHERE id != 0").run();
      return result.changes;
    });

    const count = resetTeams();
    res.json({ message: `팀/계 초기화 완료: ${count}개가 삭제되었습니다.` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "초기화 중 오류가 발생했습니다." });
  }
});

// DELETE  /api/departments/teams/:id : 팀 삭제
router.delete("/teams/:id", authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  if (Number(id) === 0) {
    return res.status(400).json({ message: "기본 팀은 삭제할 수 없습니다." });
  }
  try {
    const deleteTeam = db.transaction(() => {
      // 소속 사용자 team 참조 초기화 (ON DELETE SET DEFAULT 보완)
      db.prepare(
        "UPDATE users SET team_id = 0, team = '' WHERE team_id = ?",
      ).run(id);

      const result = db.prepare("DELETE FROM teams WHERE id = ?").run(id);
      if (result.changes === 0) throw new Error("팀/계를 찾을 수 없습니다.");
    });

    deleteTeam();
    res.json({ message: "팀/계가 삭제되었습니다." });
  } catch (error) {
    if (error.message === "팀/계를 찾을 수 없습니다.")
      return res.status(404).json({ message: error.message });
    console.error(error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

// DELETE /api/departments/reset : 부서·팀 전체 초기화 (/:id 앞에 등록)
router.delete("/reset", authenticateToken, requireAdmin, (req, res) => {
  try {
    const resetAll = db.transaction(() => {
      // 1. 모든 사용자의 부서·팀 참조 초기화 + 교육담당 미만 권한 일반직원으로 초기화
      db.prepare(
        `
        UPDATE users
        SET department_id = 0, department = '', team_id = 0, team = '',
            role = CASE WHEN role < ${roles["교육담당"]} THEN ${roles["일반직원"]} ELSE role END
      `,
      ).run();

      // 2. 팀 전체 삭제 (id=0 기본값 행 보호)
      db.prepare("DELETE FROM teams WHERE id != 0").run();

      // 3. 부서 전체 삭제 (id=0 기본값 행 보호)
      const result = db.prepare("DELETE FROM departments WHERE id != 0").run();
      return result.changes;
    });

    const count = resetAll();
    res.json({
      message: `부서·팀 초기화 완료: 부서 ${count}개가 삭제되었습니다.`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "초기화 중 오류가 발생했습니다." });
  }
});

// DELETE  /api/departments/:id : 부서 삭제
router.delete("/:id", authenticateToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  if (Number(id) === 0) {
    return res.status(400).json({ message: "기본 부서는 삭제할 수 없습니다." });
  }
  try {
    const deleteDept = db.transaction(() => {
      // 소속 사용자 department/team 참조 초기화
      db.prepare(
        "UPDATE users SET department_id = 0, department = '', team_id = 0, team = '' WHERE department_id = ?",
      ).run(id);

      const result = db.prepare("DELETE FROM departments WHERE id = ?").run(id);
      if (result.changes === 0) throw new Error("부서를 찾을 수 없습니다.");
    });

    deleteDept();
    res.json({ message: "부서가 삭제되었습니다." });
  } catch (error) {
    if (error.message === "부서를 찾을 수 없습니다.")
      return res.status(404).json({ message: error.message });
    console.error(error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

export default router;
