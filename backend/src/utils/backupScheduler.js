import cron from "node-cron";
import fs from "fs";
import path from "path";
import archiver from "archiver";
import { fileURLToPath } from "url";
import { getFormattedTime } from "./formatHelper.js";
import db from "../database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "..");
const dbPath = path.join(rootDir, "../data/education.db");
const uploadDir = path.join(rootDir, `../uploads`);
const backupDir = path.join(rootDir, "../backup");

if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const updateLastBackupTime = () => {
  const now = Date.now();
  try {
    const stmt = db.prepare(`
      INSERT INTO settings (key, value) VALUES ('last_backup_time', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);
    stmt.run(String(now));
    console.log("[Backup] 다음 증분 백업을 위해 기준 시간을 갱신했습니다.");
  } catch (error) {
    console.error("[Backup] 기준 시간 갱신 실패:", error.message);
  }
};

// 풀백업
const runFullBackup = () => {
  console.log("========================================");
  console.log("[Backup] 📦 주간 풀 백업(Full Backup) 시작...");

  const timestamp = getFormattedTime();
  const backupFileName = `full_backup_${timestamp}.zip`; // 접두사 full_
  const backupFilePath = path.join(backupDir, backupFileName);

  const output = fs.createWriteStream(backupFilePath);
  const archive = archiver("zip", { zlib: { level: 9 } });

  output.on("close", () => {
    const sizeMB = (archive.pointer() / 1024 / 1024).toFixed(2);
    console.log(`[Backup] 풀 백업 완료! : ${sizeMB} MB`);

    updateLastBackupTime();
    deleteOldFullBackups(backupFileName);
  });

  archive.on("error", (error) => console.error("[Backup] 오류:", error));
  archive.pipe(output);

  if (fs.existsSync(uploadDir)) archive.directory(uploadDir, "uploads");
  addDbFilesToArchive(archive);

  archive.finalize();
};

// 증분백업
const runIncBackup = () => {
  let lastBackupTime = 0;

  try {
    const row = db
      .prepare("SELECT value FROM settings WHERE key = 'last_backup_time'")
      .get();
    if (row && row.value) lastBackupTime = parseInt(row.value, 10);
  } catch (error) {
    console.error("[Backup] 시간 조회 실패:", error.message);
  }

  const lastBackupDate = new Date(lastBackupTime);
  console.log(`[Backup] 기준 시간: ${lastBackupDate.toLocaleString()}`);

  let newFiles = [];
  if (fs.existsSync(uploadDir)) {
    const allFiles = fs.readdirSync(uploadDir);
    newFiles = allFiles.filter((file) => {
      const filePath = path.join(uploadDir, file);

      try {
        const stats = fs.statSync(filePath);
        return stats.isFile() && stats.mtimeMs > lastBackupTime;
      } catch (error) {
        return false;
      }
    });
  }

  if (newFiles.length === 0)
    console.log("[Backup] 새로 추가된 파일이 없습니다.");
  else
    console.log(`[Backup] 신규/수정된 파일 ${newFiles.length}개를 백업합니다.`);

  const timestamp = getFormattedTime();
  const backupFileName = `inc_backup_${timestamp}.zip`;
  const backupFilePath = path.join(backupDir, backupFileName);
  const output = fs.createWriteStream(backupFilePath);
  const archive = archiver("zip", { zlib: { level: 9 } });

  output.on("close", () => {
    const sizeMB = (archive.pointer() / 1024 / 1024).toFixed(2);
    console.log(`[Backup] 완료! : ${sizeMB} MB`);
    updateLastBackupTime();
    deleteOldIncBackups();
  });

  archive.on("error", (error) => console.error("[Backup] 오류 발생: ", error));
  archive.pipe(output);

  newFiles.forEach((file) => {
    archive.file(path.join(uploadDir, file), { name: `uploads/${file}` });
  });

  addDbFilesToArchive(archive);
  archive.finalize();
};

const addDbFilesToArchive = (archive) => {
  if (fs.existsSync(dbPath)) archive.file(dbPath, { name: "education.db" });
  if (fs.existsSync(`${dbPath}-shm`))
    archive.file(`${dbPath}-shm`, { name: "education.db-shm" });
  if (fs.existsSync(`${dbPath}-wal`))
    archive.file(`${dbPath}-wal`, { name: "education.db-wal" });
};

const deleteOldFullBackups = (currentFileName) => {
  fs.readdir(backupDir, (err, files) => {
    if (err) return;

    files.forEach((file) => {
      if (
        file.startsWith("full_backup_") &&
        file !== currentFileName &&
        file.endsWith(".zip")
      ) {
        const filePath = path.join(backupDir, file);
        fs.unlink(filePath, (e) => {
          if (!e) console.log(`[Backup] 이전 풀 백업 삭제됨: ${file}`);
        });
      }
    });
  });
};

const deleteOldIncBackups = () => {
  const retentionDays = 7;
  const now = Date.now();

  fs.readdir(backupDir, (error, files) => {
    if (error) return console.error("[Backup] 백업 폴더 읽기 실패: ", error);

    files.forEach((file) => {
      if (file.startsWith("inc_backup_") && file.endsWith(".zip")) {
        const filePath = path.join(backupDir, file);

        fs.stat(filePath, (error, stats) => {
          if (error) return;

          const diffDays = (now - stats.mtimeMs) / (1000 * 60 * 60 * 24);

          if (diffDays > retentionDays) {
            fs.unlink(filePath, (error) => {
              if (error) console.error(`[Backup] 삭제 실패: ${file}`);
              else console.log(`[Backup] 오래된 파일 삭제: ${file}`);
            });
          }
        });
      }
    });
  });
};

export const initBackupScheduler = () => {
  cron.schedule(
    "0 0 2 * * 0",
    () => {
      runFullBackup();
    },
    {
      timezone: "Asia/Seoul",
    },
  );

  cron.schedule(
    "0 0 2 * * 1-6",
    () => {
      runIncBackup();
    },
    {
      timezone: "Asia/Seoul",
    },
  );

  console.log(`
  🕒 백업 스케줄러 가동됨
     - Full Backup: 매주 일요일 02:00 (이전 파일 삭제)
     - Inc Backup : 월~토요일 02:00 (7일 보관)
  `);
};
