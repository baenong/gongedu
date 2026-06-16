import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import db from "../database.js";
import requestIp from "request-ip";
import ipRangeCheck from "ip-range-check";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { roles } from "../../constants.js";

const router = express.Router();
const LOCAL_RANGES = ["127.0.0.1", "::1", "::ffff:127.0.0.1", "172.16.0.0/12"];

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 20,                   // 최대 20회
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요." },
});

// POST /api/auth/login
router.post("/login", loginLimiter, (req, res) => {
  const { username, password } = req.body;

  try {
    const user = db
      .prepare("SELECT * FROM users WHERE username = ?")
      .get(username);

    // 사용자가 없거나 비밀번호가 틀린 경우
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res
        .status(401)
        .json({ message: "아이디 또는 비밀번호가 잘못되었습니다." });
    }

    if (user.role === roles["시스템관리자"]) {
      const clientIp = requestIp.getClientIp(req);
      if (!ipRangeCheck(clientIp, LOCAL_RANGES)) {
        return res.status(403).json({
          message: "시스템 관리자 계정은 외부에서 로그인할 수 없습니다.",
        });
      }
    }

    // JWT 토큰 생성
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
        department: user.department,
        departmentId: user.department_id,
        team: user.team,
        teamId: user.team_id,
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h" },
    );

    // 클라이언트에 토큰과 유저 정보 반환
    res.json({
      message: "로그인 성공",
      token,
      user: {
        id: user.id,
        name: user.name,
        department: user.department,
        departmentId: user.department_id,
        team: user.team,
        teamId: user.team_id,
        role: user.role,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

// PUT /api/auth/password
router.put("/password", authenticateToken, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;

  try {
    const user = db
      .prepare("SELECT password FROM users WHERE id = ?")
      .get(userId);

    if (!user) {
      return res.status(404).json({ message: "사용자를 찾을 수 없습니다." });
    }

    if (!newPassword || newPassword.trim() === "") {
      return res.status(400).json({ message: "새 비밀번호를 입력해주세요." });
    }

    // 현재 비밀번호 검증
    if (!bcrypt.compareSync(currentPassword, user.password)) {
      return res
        .status(400)
        .json({ message: "현재 비밀번호가 일치하지 않습니다." });
    }

    // 새 비밀번호 해싱 및 업데이트
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    const update = db.prepare("UPDATE users SET password = ? WHERE id = ?");
    update.run(hashedPassword, userId);

    res.json({ message: "비밀번호가 성공적으로 변경되었습니다." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "비밀번호 변경 중 오류가 발생했습니다." });
  }
});

export default router;
