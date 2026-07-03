import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import archiver from "archiver";
import db from "../database.js";
import {
  authenticateToken,
  requireAdmin,
} from "../middlewares/authMiddleware.js";
import { getFormattedTime, getCurrentKST } from "../utils/formatHelper.js";
import { roles } from "../../constants.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, "../../uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 파일명에서 특수문자 제거
const sanitizeFilename = (name) => {
  return String(name)
    .replace(/[\\/:*?"<>|]/g, "")
    .trim();
};

// 수료증 접근 권한 확인
// enrollment: { user_id, course_id }
const canAccessEnrollment = (enrollment, requester) => {
  const { id, role, teamId, departmentId } = requester;

  if (enrollment.user_id === id) return true;
  if (role >= roles["총괄담당"]) return true;

  if (role === roles["교육담당"]) {
    const course = db
      .prepare("SELECT created_by FROM courses WHERE id = ?")
      .get(enrollment.course_id);
    return course?.created_by === id;
  }

  if (role === roles["부서담당"]) {
    const owner = db
      .prepare("SELECT department_id FROM users WHERE id = ?")
      .get(enrollment.user_id);
    return owner?.department_id === departmentId;
  }

  if (role === roles["팀계담당"]) {
    const owner = db
      .prepare("SELECT team_id FROM users WHERE id = ?")
      .get(enrollment.user_id);
    return owner?.team_id === teamId;
  }

  return false;
};

// 대리 등록(다른 사용자 대신 수료증 제출) 권한 확인
// 허용되면 null, 거부되면 에러 메시지를 반환한다.
const checkProxyEnrollmentPermission = (requester, targetUserId, courseId) => {
  const { role, teamId, departmentId, id: requesterId } = requester;

  if (role < roles["팀계담당"]) {
    return "대리 등록 권한이 없습니다.";
  }

  if (role >= roles["총괄담당"]) return null;

  if (role === roles["교육담당"]) {
    const course = db
      .prepare("SELECT created_by FROM courses WHERE id = ?")
      .get(courseId);
    if (!course || course.created_by !== requesterId) {
      return "본인이 등록한 교육과정만 대리 등록할 수 있습니다.";
    }
    return null;
  }

  const target = db
    .prepare("SELECT department_id, team_id FROM users WHERE id = ?")
    .get(targetUserId);
  if (!target) return "대상 사용자를 찾을 수 없습니다.";

  if (role === roles["부서담당"]) {
    return target.department_id === departmentId
      ? null
      : "같은 부서 소속 직원만 대리 등록할 수 있습니다.";
  }

  if (role === roles["팀계담당"]) {
    return target.team_id === teamId
      ? null
      : "같은 팀 소속 직원만 대리 등록할 수 있습니다.";
  }

  return "대리 등록 권한이 없습니다.";
};

const MAGIC_BYTES = {
  ".pdf": { bytes: [0x25, 0x50, 0x44, 0x46], label: "PDF" },
  ".jpg":  { bytes: [0xff, 0xd8, 0xff],       label: "JPEG" },
  ".jpeg": { bytes: [0xff, 0xd8, 0xff],       label: "JPEG" },
  ".png":  { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], label: "PNG" },
};

// PDF에서 JavaScript 실행에 사용되는 딕셔너리 키 패턴
const DANGEROUS_PDF_PATTERN = /\/JS[\s(<\r\n]|\/JavaScript|\/OpenAction|\/AA[\s(<\r\n]|\/Launch[\s(<\r\n]/;

const validateUploadedFile = (filePath, ext) => {
  const magic = MAGIC_BYTES[ext];
  if (!magic) return { valid: false, reason: "허용되지 않는 파일 형식입니다." };

  const buffer = fs.readFileSync(filePath);

  // 매직 바이트 확인
  for (let i = 0; i < magic.bytes.length; i++) {
    if (buffer[i] !== magic.bytes[i]) {
      return { valid: false, reason: `파일 내용이 ${magic.label} 형식과 일치하지 않습니다.` };
    }
  }

  // PDF 위험 키워드 스캔
  if (ext === ".pdf") {
    const content = buffer.toString("latin1");
    if (DANGEROUS_PDF_PATTERN.test(content)) {
      return { valid: false, reason: "보안상 허용되지 않는 PDF입니다. (실행 가능한 코드 포함)" };
    }
  }

  return { valid: true };
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const tempName = `temp_${Date.now()}_${Math.round(
      Math.random() * 1e9,
    )}${path.extname(file.originalname)}`;
    cb(null, tempName);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 1 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /\.(pdf|jpg|jpeg|png)$/;
    if (allowedTypes.test(path.extname(file.originalname).toLowerCase())) {
      return cb(null, true);
    }
    cb(new Error("허용되지 않는 파일 형식입니다."));
  },
});

// 수료증 제출 (본인 제출 또는 관리자 대리 등록)
// POST /api/enrollments/:courseId
router.post(
  "/:courseId",
  authenticateToken,
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (!err) return next();

      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return res
          .status(400)
          .json({ message: "파일 크기는 1MB를 초과할 수 없습니다." });
      }

      return res
        .status(400)
        .json({ message: err.message || "파일 업로드 중 오류가 발생했습니다." });
    });
  },
  (req, res) => {
    if (!req.file) return res.status(400).json({ message: "파일이 없습니다." });

    const { courseId } = req.params;
    const tempPath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();

    const proxyUserId = req.body.userId
      ? parseInt(req.body.userId, 10)
      : null;
    const isProxy = proxyUserId !== null && proxyUserId !== req.user.id;

    if (isProxy) {
      const permissionError = checkProxyEnrollmentPermission(
        req.user,
        proxyUserId,
        courseId,
      );
      if (permissionError) {
        fs.unlinkSync(tempPath);
        return res.status(403).json({ message: permissionError });
      }
    }

    const targetUserId = isProxy ? proxyUserId : req.user.id;
    const targetUser = db
      .prepare("SELECT name, team, department FROM users WHERE id = ?")
      .get(targetUserId);
    if (!targetUser) {
      fs.unlinkSync(tempPath);
      return res
        .status(404)
        .json({ message: "대상 사용자를 찾을 수 없습니다." });
    }
    const deptName = targetUser.department;

    // 매직 바이트 + PDF JavaScript 키워드 검증
    const validation = validateUploadedFile(tempPath, ext);
    if (!validation.valid) {
      fs.unlinkSync(tempPath);
      console.warn(`[업로드 차단] ${req.user.username} - ${validation.reason}`);
      return res.status(400).json({ message: validation.reason });
    }

    let finalPath = "";
    let renamedToFinal = false;

    try {
      const course = db
        .prepare("SELECT name FROM courses WHERE id = ?")
        .get(courseId);
      if (!course) throw new Error("교육과정을 찾을 수 없습니다.");

      // 표준 파일명 생성: [부서명] 교육명_팀명_이름.확장자 (대상자 기준)
      // 예: [행정지원과] 개인정보보호교육_인사계_안민수.pdf
      const cleanDept = sanitizeFilename(deptName);
      const cleanCourse = sanitizeFilename(course.name);
      const cleanTeam = sanitizeFilename(targetUser.team);
      const cleanName = sanitizeFilename(targetUser.name);

      const finalFileName = `[${cleanDept}] ${cleanCourse}_${cleanTeam}_${cleanName}${ext}`;
      finalPath = path.join(uploadDir, finalFileName);

      const existing = db
        .prepare(
          "SELECT id, state, stored_file_name FROM enrollments WHERE user_id = ? AND course_id = ?",
        )
        .get(targetUserId, courseId);

      if (isProxy && existing && existing.state === 2) {
        fs.unlinkSync(tempPath);
        return res
          .status(409)
          .json({ message: "이미 제출된 건은 대리 등록할 수 없습니다." });
      }

      // 만약 이미 같은 이름의 파일이 있다면 덮어쓰기
      fs.renameSync(tempPath, finalPath);
      renamedToFinal = true;
      const submittedAt = getCurrentKST();

      if (existing) {
        if (
          existing.stored_file_name &&
          existing.stored_file_name !== finalFileName
        ) {
          const oldFilePath = path.join(uploadDir, existing.stored_file_name);
          if (fs.existsSync(oldFilePath)) {
            try {
              fs.unlinkSync(oldFilePath);
            } catch (e) {
              console.error(`기존 파일 삭제 실패: ${existing.stored_file_name}`, e);
            }
          }
        }

        const update = db.prepare(`
        UPDATE enrollments 
        SET state = 2, file_name = ?, stored_file_name = ?, submitted_at = ?
        WHERE id = ?
      `);
        update.run(finalFileName, finalFileName, submittedAt, existing.id);
      } else {
        const insert = db.prepare(`
        INSERT INTO enrollments (user_id, course_id, state, file_name, stored_file_name, submitted_at)
        VALUES (?, ?, 2, ?, ?, ?)
      `);
        insert.run(targetUserId, courseId, finalFileName, finalFileName, submittedAt);
      }

      res.json({ message: "수료증이 제출되었습니다." });
    } catch (error) {
      // rename 전이면 tempPath, 후면 finalPath를 정리
      const cleanupPath = renamedToFinal ? finalPath : tempPath;
      if (fs.existsSync(cleanupPath)) fs.unlinkSync(cleanupPath);
      console.error(error);
      res.status(500).json({ message: "제출 처리 중 오류가 발생했습니다." });
    }
  },
);

// (관리자용) 특정 사용자의 교육별 이수 현황
// GET /api/enrollments/status/user/:userId
router.get(
  "/status/user/:userId",
  authenticateToken,
  requireAdmin,
  (req, res) => {
    try {
      const { userId } = req.params;
      const { year } = req.query;

      let query = `
      SELECT c.id as course_id, c.name as course_name, c.end_date,
             e.state, e.submitted_at, e.file_name
      FROM courses c
      LEFT JOIN enrollments e ON c.id = e.course_id AND e.user_id = ?
    `;

      const params = [userId];

      if (year) {
        const yearNum = parseInt(year, 10);
        if (isNaN(yearNum)) {
          return res.status(400).json({ message: "year는 숫자여야 합니다." });
        }
        query += ` WHERE c.year = ?`;
        params.push(yearNum);
      }

      query += ` ORDER BY c.end_date ASC`;

      const status = db.prepare(query).all(...params);
      res.json(status);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "서버 오류가 발생했습니다." });
    }
  },
);

// (관리자용) 압축 일괄 다운로드
// GET /api/enrollments/course/:courseId/download-zip
router.get("/course/:courseId/download-zip", authenticateToken, (req, res) => {
  const { role, department, departmentId, team, teamId, id: userId } = req.user;
  const { courseId } = req.params;

  // 일반 사용자(1)는 접근 불가
  if (role < roles["팀계담당"]) {
    return res.status(403).json({ message: "권한이 없습니다." });
  }

  if (role === roles["교육담당"]) {
    const course = db
      .prepare("SELECT created_by FROM courses WHERE id = ?")
      .get(courseId);
    if (!course || course.created_by !== userId) {
      return res
        .status(403)
        .json({ message: "본인이 등록한 교육과정만 다운로드할 수 있습니다." });
    }
  }

  try {
    const course = db
      .prepare("SELECT name FROM courses WHERE id = ?")
      .get(courseId);
    if (!course) {
      return res.status(404).json({ message: "교육과정을 찾을 수 없습니다." });
    }

    let query = `
      SELECT e.stored_file_name, e.file_name, u.department, u.team, u.name as user_name
      FROM enrollments e
      JOIN users u ON e.user_id = u.id
      WHERE u.role < ${roles["교육담당"]} AND e.course_id = ? AND e.stored_file_name IS NOT NULL
    `;

    const params = [courseId];

    if (role === roles["팀계담당"]) {
      query += ` AND u.team_id = ?`;
      params.push(teamId);
    }

    if (role === roles["부서담당"]) {
      query += ` AND u.department_id = ?`;
      params.push(departmentId);
    }

    // 교육담당: 쿼리 파라미터 필터 적용
    const filterDeptId = role === roles["교육담당"] ? parseInt(req.query.departmentId) || 0 : 0;
    const filterTeamId = role === roles["교육담당"] ? parseInt(req.query.teamId) || 0 : 0;

    if (filterDeptId) {
      query += ` AND u.department_id = ?`;
      params.push(filterDeptId);
    }
    if (filterTeamId) {
      query += ` AND u.team_id = ?`;
      params.push(filterTeamId);
    }

    const files = db.prepare(query).all(...params);

    if (files.length === 0) {
      return res.status(404).json({ message: "다운로드할 파일이 없습니다." });
    }
    const archive = archiver("zip", { zlib: { level: 9 } });

    const timeStr = getFormattedTime();
    const safeCourse = sanitizeFilename(course.name);

    // 파일명 설정
    let downloadName;
    if (role === roles["팀계담당"]) {
      const safeDept = sanitizeFilename(department);
      downloadName = `[${safeDept}]${team}_${safeCourse}_${timeStr}.zip`;
    } else if (role === roles["부서담당"]) {
      const safeDept = sanitizeFilename(department);
      downloadName = `[${safeDept}]${safeCourse}_${timeStr}.zip`;
    } else {
      // 교육담당: 필터 수준에 따라 파일명 결정
      if (filterTeamId) {
        const filteredTeam = db.prepare("SELECT name, department_id FROM teams WHERE id = ?").get(filterTeamId);
        const filteredDept = filteredTeam
          ? db.prepare("SELECT name FROM departments WHERE id = ?").get(filteredTeam.department_id)
          : null;
        const safeDept = sanitizeFilename(filteredDept?.name ?? "");
        const safeTeam = sanitizeFilename(filteredTeam?.name ?? "");
        downloadName = `[${safeDept}]${safeTeam}_${safeCourse}_${timeStr}.zip`;
      } else if (filterDeptId) {
        const filteredDept = db.prepare("SELECT name FROM departments WHERE id = ?").get(filterDeptId);
        const safeDept = sanitizeFilename(filteredDept?.name ?? "");
        downloadName = `[${safeDept}]${safeCourse}_${timeStr}.zip`;
      } else {
        downloadName = `${safeCourse}_${timeStr}.zip`;
      }
    }

    const encodedName = encodeURIComponent(downloadName);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodedName}"`,
    );
    archive.on("error", (err) => {
      console.error("압축 오류:", err);
      if (!res.headersSent) {
        res.status(500).json({ message: "압축 중 오류가 발생했습니다." });
      } else {
        res.destroy();
      }
    });
    archive.pipe(res);

    files.forEach((file) => {
      const filePath = path.join(uploadDir, file.stored_file_name);
      if (fs.existsSync(filePath)) {
        // 이미 파일명이 표준화되어 있으므로 그대로 압축
        archive.file(filePath, { name: file.stored_file_name });
      }
    });

    archive.finalize();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "압축 중 오류가 발생했습니다." });
  }
});

// 특정 교육과정에 대한 내 이수여부 조회
// GET /my/:courseId
router.get("/my/:courseId", authenticateToken, (req, res) => {
  const { courseId } = req.params;
  const userId = req.user.id;

  try {
    const myEnrollment = db
      .prepare(
        `
        SELECT e.id as enrollment_id, e.state, e.submitted_at, e.file_name, e.stored_file_name
        FROM enrollments e
        WHERE e.course_id = ? AND e.user_id = ? 
      `,
      )

      .get(courseId, userId);
    res.json(myEnrollment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

// 각 교육과정에 대한 내 이수여부 조회
// GET /api/enrollments/my
router.get("/my", authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const myEnrollments = db
      .prepare(
        `
      SELECT e.*, c.name as course_name, c.end_date 
      FROM enrollments e
      JOIN courses c ON e.course_id = c.id
      WHERE e.user_id = ?
      `,
      )
      .all(userId);
    res.json(myEnrollments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

// 특정 교육과정에 대한 이수현황 조회
// GET /api/enrollments/course/:courseId
router.get("/course/:courseId", authenticateToken, (req, res) => {
  const { role, departmentId, teamId, id: userId } = req.user;
  const { courseId } = req.params;

  if (role < roles["팀계담당"])
    return res.status(403).json({ message: "권한이 없습니다." });

  if (role === roles["교육담당"]) {
    const course = db
      .prepare("SELECT created_by FROM courses WHERE id = ?")
      .get(courseId);
    if (!course || course.created_by !== userId) {
      return res
        .status(403)
        .json({ message: "본인이 등록한 교육과정만 조회할 수 있습니다." });
    }
  }

  try {
    let query = `
      SELECT u.id as user_id, u.name,
             u.department, u.department_id as departmentId, 
             u.team, u.team_id as teamId,
             e.id as enrollment_id, e.state, e.submitted_at, e.file_name, e.stored_file_name
      FROM users u
      LEFT JOIN enrollments e ON u.id = e.user_id AND e.course_id = ? 
      WHERE u.role < ${roles["시스템관리자"]}
      `;

    const params = [courseId];

    if (role === roles["팀계담당"]) {
      query += ` AND u.team_id = ?`;
      params.push(teamId);
    }

    if (role === roles["부서담당"]) {
      query += ` AND u.department_id= ?`;
      params.push(departmentId);
    }

    query += ` ORDER BY u.department, u.team, u.name`;
    const status = db.prepare(query).all(...params);
    res.json(status);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

// 개별 수료증 다운로드
// GET /api/enrollments/:id/download
router.get("/:id/download", authenticateToken, (req, res) => {
  try {
    const { id } = req.params;

    const enrollment = db
      .prepare("SELECT * FROM enrollments WHERE id = ?")
      .get(id);

    if (!enrollment || !enrollment.stored_file_name) {
      return res.status(404).json({ message: "파일을 찾을 수 없습니다." });
    }

    if (!canAccessEnrollment(enrollment, req.user)) {
      return res.status(403).json({ message: "권한이 없습니다." });
    }

    const filePath = path.join(uploadDir, enrollment.stored_file_name);

    if (!fs.existsSync(filePath)) {
      return res
        .status(404)
        .json({ message: "DB에서 파일을 찾을 수 없습니다." });
    }

    res.download(filePath, path.basename(enrollment.stored_file_name));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

// 특정 제출내역 삭제
// DELETE /api/enrollments/:enrollmentId
router.delete("/:enrollmentId", authenticateToken, (req, res) => {
  const { enrollmentId } = req.params;

  try {
    const enrollment = db
      .prepare(
        "SELECT user_id, course_id, stored_file_name FROM enrollments WHERE id = ?",
      )
      .get(enrollmentId);

    if (!enrollment) {
      return res.status(404).json({ message: "제출내역을 찾을 수 없습니다." });
    }

    if (!canAccessEnrollment(enrollment, req.user)) {
      return res.status(403).json({ message: "권한이 없습니다." });
    }

    const stmt = db.prepare("DELETE FROM enrollments WHERE id = ?");
    stmt.run(enrollmentId);

    if (enrollment.stored_file_name) {
      const filePath = path.join(uploadDir, enrollment.stored_file_name);
      console.log("파일 제출내역 삭제: ", enrollment.stored_file_name);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    res.json({ message: "제출내역이 삭제되었습니다." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

export default router;
