import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import requestIp from "request-ip";
import ipRangeCheck from "ip-range-check";
import { roles } from "../../constants.js";

dotenv.config();
const LOCAL_RANGES = ["127.0.0.1", "::1", "::ffff:127.0.0.1", "172.16.0.0/12"];

// 로그인 여부 확인 (토큰 유효성 검사)
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res
      .status(401)
      .json({ code: "NO_TOKEN", message: "로그인이 필요합니다." });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      switch (err.name) {
        case "TokenExpiredError":
          return res
            .status(403)
            .json({ code: "TOKEN_EXPIRED", message: "만료된 토큰입니다." });
        case "JsonWebTokenError":
          return res.status(403).json({
            code: "INVALID_TOKEN",
            message: "유효하지 않은 토큰입니다.",
          });
        default:
          return res.status(403).json({ message: "인증에 실패했습니다." });
      }
    }

    req.user = user;

    if (user.role === roles["시스템관리자"]) {
      const clientIp = requestIp.getClientIp(req);

      if (!ipRangeCheck(clientIp, LOCAL_RANGES)) {
        console.warn(
          `🚨 외부에서 시스템 관리자 접근 시도 차단됨! IP: ${clientIp}`,
        );
        return res.status(403).json({
          message: "시스템 관리자는 서버 PC에서만 접속할 수 있습니다.",
        });
      }
    }
    next();
  });
};

// 관리자 권한 확인
export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role < roles["교육담당"]) {
    return res.status(403).json({ message: "관리자 권한이 필요합니다." });
  }
  next();
};

// 시스템관리자 전용 권한 확인 (API 키 등 민감한 설정에 사용)
export const requireSystemAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== roles["시스템관리자"]) {
    return res.status(403).json({ message: "시스템관리자 권한이 필요합니다." });
  }
  next();
};
