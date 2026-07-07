import app from "./app.js";
// import { initBackupScheduler } from "./utils/backupScheduler.js";

const PORT = process.env.PORT || 8180;

//initBackupScheduler(); // 백업 스케줄러는 일단 임시로 종료 (개발 중에는 불필요한 백업 방지)

app.listen(PORT, () => {
  console.log(`
  🚀 백엔드 서버가 실행되었습니다
  👉 주소: http://localhost:${PORT}
  `);
});
