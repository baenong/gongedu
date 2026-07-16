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
import { getLocalLlmBaseUrl } from "../services/ai/providers/localVerifier.js";

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
    const coursePlaceholders = courseIds.map(() => "?").join(",");
    const enrollments = db
      .prepare(
        `
      SELECT id, stored_file_name
      FROM enrollments
      WHERE course_id IN (${coursePlaceholders})
    `
      )
      .all(...courseIds);

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
        WHERE course_id IN (${coursePlaceholders})
      `);
      updateStmt.run(...courseIds);

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
    // API 키 등 민감한 값은 /api/settings/ai가 hasOpenaiKey/hasAnthropicKey처럼
    // boolean으로만 노출하도록 설계되어 있으므로, 이 범용 조회 엔드포인트에서는
    // 이런 성격의 키가 앞으로 추가되더라도 원문 값이 새 나가지 않도록 접미사로 넓게 거른다.
    const SENSITIVE_KEY_SUFFIXES = ["_key", "_secret", "_token", "_password"];
    settings
      .filter(
        (item) => !SENSITIVE_KEY_SUFFIXES.some((suffix) => item.key.endsWith(suffix)),
      )
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

// provider 값과 settings 테이블 키 접두사가 다른 경우가 있다(claude → anthropic,
// ANTHROPIC_API_KEY env var 관례를 따름). 새 provider를 추가할 때는 이 맵에
// 한 항목만 추가하면 GET/POST 양쪽에 자동으로 반영된다.
const PROVIDER_SETTINGS_PREFIX = {
  openai: "openai",
  claude: "anthropic",
  local: "local",
};

// GET /api/settings/ai - AI 검증 설정 조회 (API 키는 설정 여부만 반환)
router.get("/ai", authenticateToken, requireSeniorManager, (req, res) => {
  try {
    res.json({
      provider: getSetting("ai_provider") || "",
      openaiModel: getSetting(`ai_${PROVIDER_SETTINGS_PREFIX.openai}_model`) || "",
      anthropicModel:
        getSetting(`ai_${PROVIDER_SETTINGS_PREFIX.claude}_model`) || "",
      localModel: getSetting(`ai_${PROVIDER_SETTINGS_PREFIX.local}_model`) || "",
      hasOpenaiKey: Boolean(
        getSetting(`ai_${PROVIDER_SETTINGS_PREFIX.openai}_api_key`) ||
          process.env.OPENAI_API_KEY,
      ),
      hasAnthropicKey: Boolean(
        getSetting(`ai_${PROVIDER_SETTINGS_PREFIX.claude}_api_key`) ||
          process.env.ANTHROPIC_API_KEY,
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
  const { provider, model, apiKey } = req.body;
  const prefix = PROVIDER_SETTINGS_PREFIX[provider];
  if (!prefix) {
    return res.status(400).json({ message: "지원하지 않는 제공자입니다." });
  }

  try {
    const upsert = db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);
    upsert.run("ai_provider", provider);
    upsert.run(`ai_${prefix}_model`, model ?? "");
    if (apiKey) upsert.run(`ai_${prefix}_api_key`, apiKey);

    res.json({ message: "AI 설정이 저장되었습니다." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

// POST /api/settings/ai/models - 제공자의 사용 가능한 모델 목록 조회
// provider별로 "API 키 결정 방식"과 "모델 목록 조회 방식"만 다르고 나머지 흐름은
// 동일하므로, 두 provider가 각자 구현하지 않고 이 맵에서 공통 흐름을 처리한다.
const AI_MODEL_PROVIDERS = {
  openai: {
    resolveKey: (apiKey) =>
      apiKey || getSetting("ai_openai_api_key") || process.env.OPENAI_API_KEY,
    listModelIds: async (key) => {
      const list = await new OpenAI({ apiKey: key }).models.list();
      return list.data.map((m) => m.id).sort();
    },
  },
  claude: {
    resolveKey: (apiKey) =>
      apiKey ||
      getSetting("ai_anthropic_api_key") ||
      process.env.ANTHROPIC_API_KEY,
    listModelIds: async (key) => {
      const list = await new Anthropic({ apiKey: key }).models.list();
      return list.data.map((m) => m.id).sort();
    },
  },
  // local(Ollama)은 API 키가 없으므로 키 확인 없이 서버에 설치된 모델 목록을 조회한다.
  local: {
    requiresKey: false,
    listModelIds: async () => {
      const response = await fetch(`${getLocalLlmBaseUrl()}/api/tags`);
      if (!response.ok) {
        throw new Error(`Ollama 응답 오류: ${response.status}`);
      }
      const data = await response.json();
      return (data.models ?? []).map((m) => m.name).sort();
    },
  },
};

// apiKey를 body로 직접 받으면(아직 저장 전인 입력값) 그 키로 조회하고,
// 없으면 저장된 값 또는 .env 값으로 폴백한다.
router.post(
  "/ai/models",
  authenticateToken,
  requireSeniorManager,
  async (req, res) => {
    const { provider, apiKey } = req.body;
    const config = AI_MODEL_PROVIDERS[provider];
    if (!config) {
      return res.status(400).json({ message: "지원하지 않는 제공자입니다." });
    }

    try {
      let key;
      if (config.requiresKey !== false) {
        key = config.resolveKey(apiKey);
        if (!key) {
          return res.status(400).json({ message: "API 키를 먼저 입력하세요." });
        }
      }
      const models = await config.listModelIds(key);
      res.json({ models });
    } catch (error) {
      console.error("모델 목록 조회 실패:", error);
      res
        .status(502)
        .json({ message: "모델 목록을 가져오지 못했습니다. API 키를 확인하세요." });
    }
  },
);

export default router;
