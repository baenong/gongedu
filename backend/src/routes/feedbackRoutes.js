import express from "express";
import db from "../database.js";
import {
  authenticateToken,
  requireSeniorManager,
} from "../middlewares/authMiddleware.js";
import { getCurrentKST } from "../utils/formatHelper.js";

const router = express.Router();

// 기능개선 의견 작성 (로그인한 사용자 누구나)
// POST /api/feedback
router.post("/", authenticateToken, (req, res) => {
  const { content } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ message: "내용을 입력해주세요." });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO feedbacks (user_id, user_name, department, content, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(
      req.user.id,
      req.user.name,
      req.user.department,
      content.trim(),
      getCurrentKST(),
    );

    res.status(201).json({ message: "의견이 등록되었습니다. 감사합니다!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

// 다른 사용자들이 남긴 의견 목록 (익명 — 시간/내용/좋아요만 노출)
// GET /api/feedback/public
router.get("/public", authenticateToken, (req, res) => {
  try {
    const feedbacks = db
      .prepare(
        `
        SELECT f.id, f.content, f.created_at,
          (SELECT COUNT(*) FROM feedback_likes WHERE feedback_id = f.id) as like_count,
          EXISTS(
            SELECT 1 FROM feedback_likes WHERE feedback_id = f.id AND user_id = ?
          ) as liked_by_me
        FROM feedbacks f
        ORDER BY f.created_at DESC
        `,
      )
      .all(req.user.id);
    res.json(feedbacks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

// 의견에 좋아요 토글
// POST /api/feedback/:id/like
router.post("/:id/like", authenticateToken, (req, res) => {
  const { id } = req.params;

  try {
    const feedback = db.prepare("SELECT id FROM feedbacks WHERE id = ?").get(id);
    if (!feedback) {
      return res.status(404).json({ message: "의견을 찾을 수 없습니다." });
    }

    const existing = db
      .prepare(
        "SELECT id FROM feedback_likes WHERE feedback_id = ? AND user_id = ?",
      )
      .get(id, req.user.id);

    if (existing) {
      db.prepare("DELETE FROM feedback_likes WHERE id = ?").run(existing.id);
    } else {
      db.prepare(
        "INSERT INTO feedback_likes (feedback_id, user_id) VALUES (?, ?)",
      ).run(id, req.user.id);
    }

    const { count } = db
      .prepare("SELECT COUNT(*) as count FROM feedback_likes WHERE feedback_id = ?")
      .get(id);

    res.json({ liked: !existing, like_count: count });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

// (총괄담당 이상용) 기능개선 의견 목록 조회
// GET /api/feedback
router.get("/", authenticateToken, requireSeniorManager, (req, res) => {
  try {
    const feedbacks = db
      .prepare("SELECT * FROM feedbacks ORDER BY id DESC")
      .all();
    res.json(feedbacks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

// (총괄담당 이상용) 기능개선 의견 확인 여부 토글
// PATCH /api/feedback/:id/checked
router.patch(
  "/:id/checked",
  authenticateToken,
  requireSeniorManager,
  (req, res) => {
    const { id } = req.params;
    const { checked } = req.body;

    try {
      const result = db
        .prepare("UPDATE feedbacks SET checked = ? WHERE id = ?")
        .run(checked ? 1 : 0, id);

      if (result.changes === 0) {
        return res.status(404).json({ message: "의견을 찾을 수 없습니다." });
      }

      res.json({ message: "확인 상태가 변경되었습니다." });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "서버 오류가 발생했습니다." });
    }
  },
);

export default router;
