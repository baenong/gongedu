import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import db from "../database.js";
import {
  authenticateToken,
  requireSeniorManager,
} from "../middlewares/authMiddleware.js";
import { getSetting } from "../utils/settings.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, `../../uploads`);

// DELETE /api/settings/cleanup
router.delete("/cleanup", authenticateToken, requireSeniorManager, (req, res) => {
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
router.get("/", authenticateToken, requireSeniorManager, (req, res) => {
  try {
    const settings = db.prepare("SELECT * FROM settings").all();
    const settingsObj = {};
    // AI API 키는 /api/settings/ai가 hasOpenaiKey/hasAnthropicKey로만 노출하도록
    // 설계되어 있으므로, 이 범용 조회 엔드포인트에서는 원문 키 값을 제외한다.
    settings
      .filter((item) => !item.key.endsWith("_api_key"))
      .forEach((item) => (settingsObj[item.key] = item.value));
    res.json(settingsObj);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

// POST /api/settings
router.post("/", authenticateToken, requireSeniorManager, (req, res) => {
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

// GET /api/settings/ai - AI 검증 설정 조회 (API 키는 설정 여부만 반환)
router.get("/ai", authenticateToken, requireSeniorManager, (req, res) => {
  try {
    res.json({
      provider: getSetting("ai_provider") || "",
      openaiModel: getSetting("ai_openai_model") || "",
      anthropicModel: getSetting("ai_anthropic_model") || "",
      hasOpenaiKey: Boolean(
        getSetting("ai_openai_api_key") || process.env.OPENAI_API_KEY,
      ),
      hasAnthropicKey: Boolean(
        getSetting("ai_anthropic_api_key") || process.env.ANTHROPIC_API_KEY,
      ),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

// POST /api/settings/ai - AI 검증 설정 저장
// API 키 입력란을 비워두면 기존에 저장된 값을 그대로 유지한다.
router.post("/ai", authenticateToken, requireSeniorManager, (req, res) => {
  const { provider, openaiModel, anthropicModel, openaiApiKey, anthropicApiKey } =
    req.body;

  try {
    const upsert = db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);
    upsert.run("ai_provider", provider ?? "");
    upsert.run("ai_openai_model", openaiModel ?? "");
    upsert.run("ai_anthropic_model", anthropicModel ?? "");
    if (openaiApiKey) upsert.run("ai_openai_api_key", openaiApiKey);
    if (anthropicApiKey) upsert.run("ai_anthropic_api_key", anthropicApiKey);

    res.json({ message: "AI 설정이 저장되었습니다." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

// POST /api/settings/ai/models - 제공자의 사용 가능한 모델 목록 조회
// apiKey를 body로 직접 받으면(아직 저장 전인 입력값) 그 키로 조회하고,
// 없으면 저장된 값 또는 .env 값으로 폴백한다.
router.post(
  "/ai/models",
  authenticateToken,
  requireSeniorManager,
  async (req, res) => {
    const { provider, apiKey } = req.body;

    try {
      if (provider === "openai") {
        const key =
          apiKey || getSetting("ai_openai_api_key") || process.env.OPENAI_API_KEY;
        if (!key) {
          return res.status(400).json({ message: "API 키를 먼저 입력하세요." });
        }
        const client = new OpenAI({ apiKey: key });
        const list = await client.models.list();
        const models = list.data.map((m) => m.id).sort();
        return res.json({ models });
      }

      if (provider === "claude") {
        const key =
          apiKey ||
          getSetting("ai_anthropic_api_key") ||
          process.env.ANTHROPIC_API_KEY;
        if (!key) {
          return res.status(400).json({ message: "API 키를 먼저 입력하세요." });
        }
        const client = new Anthropic({ apiKey: key });
        const list = await client.models.list();
        const models = list.data.map((m) => m.id).sort();
        return res.json({ models });
      }

      return res.status(400).json({ message: "지원하지 않는 제공자입니다." });
    } catch (error) {
      console.error("모델 목록 조회 실패:", error);
      res
        .status(502)
        .json({ message: "모델 목록을 가져오지 못했습니다. API 키를 확인하세요." });
    }
  },
);

export default router;
