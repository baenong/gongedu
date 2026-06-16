import express from "express";
import cors from "cors";
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

app.use(
  cors({
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

app.get("/", (req, res) => {
  res.send("Gong Edu is running...");
});

app.listen(PORT, () => {
  console.log(`
  🚀 백엔드 서버가 실행되었습니다
  👉 주소: http://localhost:${PORT}
  `);
});
