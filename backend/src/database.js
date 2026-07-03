import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { roles } from "../constants.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, "../data/education.db");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// 테이블 초기화 함수
export function initDatabase() {
  // 1. Users
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL, -- 사번 또는 ID
      password TEXT NOT NULL,        -- 암호화된 비밀번호
      name TEXT NOT NULL,
      department_id INTEGER DEFAULT 0,
      department TEXT,
      team_id INTEGER DEFAULT 0,
      team TEXT,
      role INTEGER NOT NULL DEFAULT 1, -- 1:일반, 2:팀담당, 3:부서담당, 4:교육담당, 5:총괄담당, 6:시스템관리자
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (department_id) REFERENCES departments (id) ON DELETE SET DEFAULT,
      FOREIGN KEY (team_id) REFERENCES teams (id) ON DELETE SET DEFAULT
    )
  `);

  // 2. Settings
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  // 3. Courses
  db.exec(`
    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      name TEXT NOT NULL,
      end_date TEXT NOT NULL,
      detail TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
    )
  `);

  // 4. Enrollments
  db.exec(`
    CREATE TABLE IF NOT EXISTS enrollments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      state INTEGER DEFAULT 1,
      file_name TEXT,
      stored_file_name TEXT,
      submitted_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE
    )
  `);

  // 5. Departments
  db.exec(`
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      order_index INTEGER NOT NULL
    )
  `);

  // 6. Teams
  db.exec(`
    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      order_index INTEGER NOT NULL,
      department_id INTEGER NOT NULL,
      UNIQUE (name, department_id),
      FOREIGN KEY (department_id) REFERENCES departments (id) ON DELETE CASCADE
    )
  `);

  // --- 초기 데이터 주입 ---

  // 0. id=0 기본 부서/팀 삽입 (FK 기본값용, 이미 있으면 생략)
  const defaultDeptCheck = db
    .prepare("SELECT id FROM departments WHERE id = 0")
    .get();
  if (!defaultDeptCheck) {
    db.prepare(
      "INSERT INTO departments (id, name, order_index) VALUES (0, '미지정', 9999)",
    ).run();
  }

  const defaultTeamCheck = db
    .prepare("SELECT id FROM teams WHERE id = 0")
    .get();
  if (!defaultTeamCheck) {
    db.prepare(
      "INSERT INTO teams (id, name, order_index, department_id) VALUES (0, '미지정', 9999, 0)",
    ).run();
  }

  // 1. 초기 관리자 계정 생성 (이미 있으면 생성 안 함)
  const adminCheck = db
    .prepare("SELECT * FROM users WHERE username = ?")
    .get("geadmin");

  if (!adminCheck) {
    console.log("📢 초기 관리자 계정(admin)을 생성합니다.");
    const hashedPassword = bcrypt.hashSync("GongEdu!234", 10); // 초기 비번

    const insertAdmin = db.prepare(`
      INSERT INTO users (username, password, name, role)
      VALUES (?, ?, ?, ?)
    `);

    insertAdmin.run(
      "geadmin",
      hashedPassword,
      "시스템관리자",
      roles["시스템관리자"],
    );
  }

  // 2. 초기 IP 설정 및 부서명 설정
  const ipCheck = db
    .prepare("SELECT * FROM settings WHERE key = ?")
    .get("allowed_ip_range");
  if (!ipCheck) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run(
      "allowed_ip_range",
      "",
    );
  }

  migrateDatabase();
}

function migrateDatabase() {
  migrateEnrollmentFileNaming();
}

// 기존에 "[부서] 교육명_팀_이름.ext" 형태로 저장된 수료증 파일을
// 개인정보가 없는 opaque(UUID) 파일명으로 1회 전환한다.
function migrateEnrollmentFileNaming() {
  const FLAG_KEY = "enrollment_file_naming_migrated";
  const done = db.prepare("SELECT value FROM settings WHERE key = ?").get(FLAG_KEY);
  if (done) return;

  const uploadDir = path.join(__dirname, "../uploads");
  const rows = db
    .prepare(
      "SELECT id, stored_file_name FROM enrollments WHERE stored_file_name IS NOT NULL",
    )
    .all();

  const update = db.prepare(
    "UPDATE enrollments SET stored_file_name = ?, file_name = ? WHERE id = ?",
  );

  let migratedCount = 0;
  for (const row of rows) {
    const oldPath = path.join(uploadDir, row.stored_file_name);
    if (!fs.existsSync(oldPath)) continue;

    const ext = path.extname(row.stored_file_name);
    const newName = `${crypto.randomUUID()}${ext}`;
    const newPath = path.join(uploadDir, newName);

    fs.renameSync(oldPath, newPath);
    update.run(newName, newName, row.id);
    migratedCount++;
  }

  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(FLAG_KEY, String(migratedCount));

  console.log(
    `📦 기존 수료증 파일명 마이그레이션 완료: ${migratedCount}건을 opaque 파일명으로 전환했습니다.`,
  );
}

export default db;
