import express from "express";
import db from "../database.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { getCurrentKST } from "../utils/formatHelper.js";
import { roles } from "../../constants.js";

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

// (시스템관리자용) 기능개선 의견 목록 조회
// GET /api/feedback
router.get("/", authenticateToken, (req, res) => {
  if (req.user.role !== roles["시스템관리자"]) {
    return res.status(403).json({ message: "권한이 없습니다." });
  }

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

// (시스템관리자용) 기능개선 의견 확인 여부 토글
// PATCH /api/feedback/:id/checked
router.patch("/:id/checked", authenticateToken, (req, res) => {
  if (req.user.role !== roles["시스템관리자"]) {
    return res.status(403).json({ message: "권한이 없습니다." });
  }

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
});

export default router;
