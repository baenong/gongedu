import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import db from "../database.js";
import {
  authenticateToken,
  requireAdmin,
} from "../middlewares/authMiddleware.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, `../../uploads`);

// DELETE /api/settings/cleanup
router.delete("/cleanup", authenticateToken, requireAdmin, (req, res) => {
  const { year, mode } = req.body; // mode: 'files_only'(파일만) 또는 'all'(데이터포함)

  if (!year) {
    return res
      .status(400)
      .json({ message: "정리할 연도(year)를 입력해주세요." });
  }

  try {
    // 해당 연도의 모든 교육과정 ID 조회
    const courses = db
      .prepare("SELECT id FROM courses WHERE year = ?")
      .all(year);
    const courseIds = courses.map((c) => c.id);

    if (courseIds.length === 0) {
      return res
        .status(404)
        .json({ message: `${year}년도에는 등록된 교육과정이 없습니다.` });
    }

    // 해당 연도의 모든 이수 내역(파일 정보 포함) 조회
    // course_id가 위의 courseIds 배열 안에 있는 경우만 조회
    const enrollments = db
      .prepare(
        `
      SELECT id, stored_file_name 
      FROM enrollments 
      WHERE course_id IN (${courseIds.join(",")})
    `
      )
      .all();

    let deletedFileCount = 0;

    // 1. 실제 파일 삭제 작업 (공통)
    enrollments.forEach((record) => {
      if (record.stored_file_name) {
        const filePath = path.join(uploadDir, record.stored_file_name);
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath); // 파일 삭제
            deletedFileCount++;
          }
        } catch (err) {
          console.error(`파일 삭제 실패: ${filePath}`, err);
        }
      }
    });

    // 2. 모드에 따른 DB 처리
    if (mode === "files_only") {
      // [파일만 삭제] DB에서 파일 경로만 NULL로 변경 (기록은 유지)
      const updateStmt = db.prepare(`
        UPDATE enrollments 
        SET stored_file_name = NULL, file_name = NULL 
        WHERE course_id IN (${courseIds.join(",")})
      `);
      updateStmt.run();

      res.json({
        message: `${year}년도 수료증 파일 ${deletedFileCount}개가 삭제되었습니다. (이수 기록은 유지됨)`,
      });
    } else if (mode === "all") {
      // [전체 삭제] 교육과정 자체를 삭제 (Cascade 설정에 의해 이수내역도 자동 삭제)
      const deleteStmt = db.prepare(`DELETE FROM courses WHERE year = ?`);
      deleteStmt.run(year);

      res.json({
        message: `${year}년도 데이터와 파일 ${deletedFileCount}개가 모두 영구 삭제되었습니다.`,
      });
    } else {
      res.status(400).json({ message: "잘못된 삭제 모드입니다." });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "데이터 정리 중 오류가 발생했습니다." });
  }
});

// GET /api/settings
router.get("/", authenticateToken, requireAdmin, (req, res) => {
  try {
    const settings = db.prepare("SELECT * FROM settings").all();
    const settingsObj = {};
    settings.forEach((item) => (settingsObj[item.key] = item.value));
    res.json(settingsObj);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

// POST /api/settings
router.post("/", authenticateToken, requireAdmin, (req, res) => {
  const { key, value } = req.body;
  try {
    const stmt = db.prepare(`
            INSERT INTO settings (key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `);
    stmt.run(key, value);
    res.json({ message: "설정이 저장되었습니다." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

export default router;
