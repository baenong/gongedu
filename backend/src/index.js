import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import morgan from "morgan";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createStream } from "rotating-file-stream";
import { initDatabase } from "./database.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import courseRoutes from "./routes/courseRoutes.js";
import enrollmentRoutes from "./routes/enrollmentRoutes.js";
import settingRoutes from "./routes/settingRoutes.js";
import departmentRoutes from "./routes/departmentRoutes.js";
import feedbackRoutes from "./routes/feedbackRoutes.js";
import { checkIpWhitelist } from "./middlewares/ipMiddleware.js";
// import { initBackupScheduler } from "./utils/backupScheduler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logDir = path.join(__dirname, "../../logs");
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

dotenv.config();

const app = express();
app.set("trust proxy", 1); // Docker nginx 컨테이너를 첫 번째 프록시로 신뢰

morgan.token("user", (req, res) => {
  if (req.user && req.user.username) {
    return `[${req.user.username}]`; // 예: [admin] or [2024001]
  }
  return "[Guest]"; // 비로그인 상태
});

morgan.token("date-kst", (req, res) => {
  return new Date().toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    hour12: false,
  });
});

const logFormat =
  "[:date-kst] :remote-addr - :user :method :url :status - :response-time ms";

const logStream = createStream(
  (time) => {
    if (!time) return "access.log";
    const y = time.getFullYear();
    const m = String(time.getMonth() + 1).padStart(2, "0");
    const d = String(time.getDate()).padStart(2, "0");
    return `access_${y}-${m}-${d}.log`;
  },
  { interval: "1d", path: logDir, maxFiles: 90 },
);
app.use(morgan(logFormat));
app.use(morgan(logFormat, { stream: logStream }));

const PORT = process.env.PORT || 8180;

// 프론트엔드는 항상 nginx(운영)/vite 프록시(개발)를 통해 같은 origin으로 API를 호출하므로
// 브라우저의 cross-origin 요청은 기본적으로 차단한다. 별도 도메인에서 API를 호출해야 하는
// 경우에만 .env에 CORS_ORIGIN(콤마로 구분된 origin 목록)을 설정한다.
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
  : false;

app.use(helmet());
app.use(
  cors({
    origin: corsOrigins,
    exposedHeaders: ["Content-Disposition"],
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(checkIpWhitelist);

// DB 초기화
initDatabase();
//initBackupScheduler(); // 백업 스케줄러는 일단 임시로 종료 (개발 중에는 불필요한 백업 방지)

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/enrollments", enrollmentRoutes);
app.use("/api/settings", settingRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/feedback", feedbackRoutes);

app.get("/", (req, res) => {
  res.send("Gong Edu is running...");
});

// 전역 에러 핸들러 — 라우터에서 잡지 못한 에러(예: 스트리밍 도중 발생하는
// multer 파일 크기 초과)가 기본 500 HTML 응답 대신 JSON 메시지로 나가도록 한다.
app.use((err, req, res, next) => {
  if (err.name === "MulterError" && err.code === "LIMIT_FILE_SIZE") {
    return res
      .status(400)
      .json({ message: "파일 크기는 1MB를 초과할 수 없습니다." });
  }
  console.error(err);
  res.status(500).json({ message: "서버 오류가 발생했습니다." });
});

app.listen(PORT, () => {
  console.log(`
  🚀 백엔드 서버가 실행되었습니다
  👉 주소: http://localhost:${PORT}
  `);
});
