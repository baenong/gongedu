import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import path from "path";
import { fileURLToPath } from "url";
import { roles } from "../constants.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath =
  process.env.DB_PATH || path.join(__dirname, "../data/education.db");
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
      department_id INTEGER DEFAULT 0,
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
      ai_verification TEXT,
      ai_flagged INTEGER DEFAULT 0,
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

  // 7. Feedback (기능개선 의견)
  db.exec(`
    CREATE TABLE IF NOT EXISTS feedbacks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_name TEXT,
      department TEXT,
      content TEXT NOT NULL,
      checked INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
    )
  `);

  // 8. Feedback Likes
  db.exec(`
    CREATE TABLE IF NOT EXISTS feedback_likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      feedback_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      UNIQUE (feedback_id, user_id),
      FOREIGN KEY (feedback_id) REFERENCES feedbacks (id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
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
  const courseColumns = db.prepare("PRAGMA table_info(courses)").all();
  const hasDepartmentId = courseColumns.some(
    (col) => col.name === "department_id",
  );
  if (!hasDepartmentId) {
    db.exec(
      "ALTER TABLE courses ADD COLUMN department_id INTEGER DEFAULT 0",
    );
  }

  const enrollmentColumns = db.prepare("PRAGMA table_info(enrollments)").all();
  const hasAiVerification = enrollmentColumns.some(
    (col) => col.name === "ai_verification",
  );
  if (!hasAiVerification) {
    db.exec("ALTER TABLE enrollments ADD COLUMN ai_verification TEXT");
  }
  const hasAiFlagged = enrollmentColumns.some(
    (col) => col.name === "ai_flagged",
  );
  if (!hasAiFlagged) {
    db.exec(
      "ALTER TABLE enrollments ADD COLUMN ai_flagged INTEGER DEFAULT 0",
    );
  }

  const feedbackColumns = db.prepare("PRAGMA table_info(feedbacks)").all();
  const hasChecked = feedbackColumns.some((col) => col.name === "checked");
  if (!hasChecked) {
    db.exec("ALTER TABLE feedbacks ADD COLUMN checked INTEGER DEFAULT 0");
  }

  // enrollments(user_id, course_id) UNIQUE 보장.
  // 인덱스가 없을 때(과거 버전 DB) 딱 한 번만 중복 행을 정리한 뒤 인덱스를 건다.
  // 인덱스가 이미 있으면 유니크 제약상 중복이 생길 수 없으므로 매 부팅마다
  // 전체 스캔하는 GROUP BY 정리 작업은 건너뛴다.
  const indexExists = db
    .prepare(
      "SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = 'idx_enrollments_user_course'",
    )
    .get();
  if (!indexExists) {
    const dedupeResult = db
      .prepare(
        `DELETE FROM enrollments WHERE id NOT IN (
           SELECT MAX(id) FROM enrollments GROUP BY user_id, course_id
         )`,
      )
      .run();
    if (dedupeResult.changes > 0) {
      console.warn(
        `⚠️ enrollments 중복 (user_id, course_id) ${dedupeResult.changes}건 정리했습니다.`,
      );
    }
    db.exec(
      "CREATE UNIQUE INDEX idx_enrollments_user_course ON enrollments(user_id, course_id)",
    );
  }
}

export default db;
