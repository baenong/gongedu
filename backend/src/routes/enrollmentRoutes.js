import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import contentDisposition from "content-disposition";
import { fileURLToPath } from "url";
import archiver from "archiver";
import db from "../database.js";
import {
  authenticateToken,
  requireAdmin,
} from "../middlewares/authMiddleware.js";
import { getFormattedTime, getCurrentKST } from "../utils/formatHelper.js";
import {
  sanitizeFilename,
  buildDisplayFileName,
} from "../utils/enrollmentFileName.js";
import { roles, MIME_TYPES } from "../../constants.js";
import {
  verifyCertificate,
  isAiConfigured,
  isAiFlagged,
} from "../services/ai/verifyCertificate.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, "../../uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// AI 검증(제출 시 자동 실행 또는 관리자의 수동 재검증)이 진행 중인 enrollmentId를 추적한다.
// - 동일 건에 대한 동시 AI 검증 요청(중복 유료 API 호출/결과 덮어쓰기)을 막고
// - 검증 진행 중 삭제되어 결과가 조용히 유실되는 것을 막는 데 사용한다.
// 단일 Node 프로세스 전제(멀티 프로세스로 확장 시에는 DB 기반 락으로 교체 필요).
const aiInFlightEnrollmentIds = new Set();

// 수료증 제출 시 AI 검증은 응답을 막지 않도록 백그라운드에서 수행하고,
// 끝나는 대로 결과만 별도로 반영한다. 검증에 실패하거나 오래 걸리더라도
// 제출 자체는 이미 완료 처리된 상태이므로 사용자 경험에 영향이 없다.
async function runBackgroundAiVerification({
  enrollmentId,
  filePath,
  mimeType,
  courseName,
  submitterName,
  courseYear,
}) {
  try {
    const aiResult = await verifyCertificate({
      fileBuffer: fs.readFileSync(filePath),
      mimeType,
      courseName,
      submitterName,
      courseYear,
    });
    const aiVerification = aiResult ? JSON.stringify(aiResult) : null;
    const aiFlagged = isAiFlagged(aiResult) ? 1 : 0;

    // 검증이 끝나기 전에 해당 건이 삭제되었다면 changes가 0이 되어 조용히 무시된다.
    db.prepare(
      "UPDATE enrollments SET ai_verification = ?, ai_flagged = ? WHERE id = ?",
    ).run(aiVerification, aiFlagged, enrollmentId);
  } catch (error) {
    console.error(`백그라운드 AI 검증 실패 (enrollment ${enrollmentId}):`, error);
  } finally {
    aiInFlightEnrollmentIds.delete(enrollmentId);
  }
}

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
  async (req, res) => {
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
        .prepare("SELECT name, year FROM courses WHERE id = ?")
        .get(courseId);
      if (!course) throw new Error("교육과정을 찾을 수 없습니다.");

      // 디스크에는 개인정보가 드러나지 않는 opaque 파일명으로 저장한다.
      // 부서/팀/이름이 반영된 "보기 좋은" 파일명은 조회·다운로드 시점에 동적으로 만든다
      // (부서 이동 등으로 소속이 바뀐 뒤에도 항상 최신 값을 보여주기 위함).
      const finalFileName = `${crypto.randomUUID()}${ext}`;
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

      // 등록 확정(파일 저장)은 AI 검증(수 초가 걸리는 외부 API 호출)보다 먼저,
      // await 없이 동기적으로 끝낸다. INSERT ... ON CONFLICT는 (user_id, course_id)
      // UNIQUE 인덱스와 함께 원자적으로 처리되므로, 동시에 들어온 중복 제출 요청이
      // AI 검증을 기다리는 사이에 끼어들어 중복 행을 만드는 것을 막아준다.
      const upsert = db.prepare(`
        INSERT INTO enrollments (user_id, course_id, state, file_name, stored_file_name, submitted_at)
        VALUES (?, ?, 2, ?, ?, ?)
        ON CONFLICT(user_id, course_id) DO UPDATE SET
          state = 2,
          file_name = excluded.file_name,
          stored_file_name = excluded.stored_file_name,
          submitted_at = excluded.submitted_at
      `);
      const upsertResult = upsert.run(
        targetUserId,
        courseId,
        finalFileName,
        finalFileName,
        submittedAt,
      );
      // UPDATE 분기(기존 행 존재)면 id가 그대로이고, INSERT 분기면 방금 생성된
      // lastInsertRowid가 새 id이므로 별도 SELECT로 다시 조회할 필요가 없다.
      const enrollmentId = existing ? existing.id : upsertResult.lastInsertRowid;

      if (
        existing &&
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

      // AI 검증(수 초가 걸리는 외부 API 호출)은 응답을 기다리게 하지 않고 백그라운드로
      // 돌린다. 오탐 가능성 때문에 AI 판단과 무관하게 제출 자체는 이미 확정된 상태이므로,
      // 사용자는 검증이 끝나길 기다릴 필요 없이 즉시 제출 완료 화면을 볼 수 있다.
      const aiConfigured = isAiConfigured();
      if (aiConfigured) {
        aiInFlightEnrollmentIds.add(enrollmentId);
        runBackgroundAiVerification({
          enrollmentId,
          filePath: finalPath,
          mimeType: MIME_TYPES[ext] || "application/octet-stream",
          courseName: course.name,
          submitterName: targetUser.name,
          courseYear: course.year,
        }).catch((error) => {
          console.error(`백그라운드 AI 검증 처리 실패 (enrollment ${enrollmentId}):`, error);
        });
      }

      res.json({
        message: "수료증이 제출되었습니다.",
        aiSkipReason: aiConfigured ? null : "missing_api_key",
      });
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
             e.state, e.submitted_at, e.file_name, e.stored_file_name
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

      const owner = db
        .prepare("SELECT name, department, team FROM users WHERE id = ?")
        .get(userId);

      const enriched = status.map(({ stored_file_name, ...row }) => {
        if (row.state !== 2 || !stored_file_name || !owner) return row;
        const ext = path.extname(stored_file_name);
        return {
          ...row,
          file_name: buildDisplayFileName({
            department: owner.department,
            team: owner.team,
            name: owner.name,
            courseName: row.course_name,
            ext,
          }),
        };
      });

      res.json(enriched);
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

    const usedNames = new Set();
    files.forEach((file) => {
      const filePath = path.join(uploadDir, file.stored_file_name);
      if (fs.existsSync(filePath)) {
        // ZIP 안의 파일명은 다운로드 시점의 현재 소속 기준으로 매번 새로 만든다.
        const ext = path.extname(file.stored_file_name);
        let displayName = buildDisplayFileName({
          department: file.department,
          team: file.team,
          name: file.user_name,
          courseName: course.name,
          ext,
        });

        // 같은 부서/팀 안에 동명이인이 있으면 파일명이 충돌할 수 있으므로 접미사를 붙인다.
        if (usedNames.has(displayName)) {
          const base = displayName.slice(0, -ext.length);
          let suffix = 2;
          while (usedNames.has(`${base}_${suffix}${ext}`)) suffix++;
          displayName = `${base}_${suffix}${ext}`;
        }
        usedNames.add(displayName);

        archive.file(filePath, { name: displayName });
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

    if (myEnrollment && myEnrollment.state === 2 && myEnrollment.stored_file_name) {
      const owner = db
        .prepare("SELECT name, department, team FROM users WHERE id = ?")
        .get(userId);
      const course = db.prepare("SELECT name FROM courses WHERE id = ?").get(courseId);
      const ext = path.extname(myEnrollment.stored_file_name);
      myEnrollment.file_name = buildDisplayFileName({
        department: owner.department,
        team: owner.team,
        name: owner.name,
        courseName: course?.name ?? "",
        ext,
      });
    }

    if (myEnrollment) delete myEnrollment.stored_file_name;

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

    const owner = db
      .prepare("SELECT name, department, team FROM users WHERE id = ?")
      .get(userId);

    const enriched = myEnrollments.map(({ stored_file_name, ...row }) => {
      if (row.state !== 2 || !stored_file_name || !owner) return row;
      const ext = path.extname(stored_file_name);
      return {
        ...row,
        file_name: buildDisplayFileName({
          department: owner.department,
          team: owner.team,
          name: owner.name,
          courseName: row.course_name,
          ext,
        }),
      };
    });

    res.json(enriched);
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
             e.id as enrollment_id, e.state, e.submitted_at, e.file_name, e.stored_file_name,
             e.ai_verification, e.ai_flagged
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

    const course = db.prepare("SELECT name FROM courses WHERE id = ?").get(courseId);
    const enriched = status.map(({ stored_file_name, ai_verification, ...row }) => {
      const ai_verified = ai_verification !== null && ai_verification !== undefined;
      let ai_reasoning = null;
      if (ai_verification) {
        try {
          ai_reasoning = JSON.parse(ai_verification).reasoning ?? null;
        } catch {
          ai_reasoning = null;
        }
      }

      if (row.state !== 2 || !stored_file_name) {
        return { ...row, ai_verified, ai_reasoning };
      }

      const ext = path.extname(stored_file_name);
      return {
        ...row,
        ai_verified,
        ai_reasoning,
        file_name: buildDisplayFileName({
          department: row.department,
          team: row.team,
          name: row.name,
          courseName: course?.name ?? "",
          ext,
        }),
      };
    });

    res.json(enriched);
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

    // 다운로드 시점의 현재 소속 정보로 파일명을 새로 조합한다.
    const owner = db
      .prepare(
        `SELECT u.name, u.department, u.team, c.name as course_name
         FROM enrollments e
         JOIN users u ON e.user_id = u.id
         JOIN courses c ON e.course_id = c.id
         WHERE e.id = ?`,
      )
      .get(id);

    const ext = path.extname(enrollment.stored_file_name);
    const displayFileName = owner
      ? buildDisplayFileName({
          department: owner.department,
          team: owner.team,
          name: owner.name,
          courseName: owner.course_name,
          ext,
        })
      : path.basename(enrollment.stored_file_name);

    // Express의 res.download()/res.sendFile()은 내부적으로 send 모듈이 경로를
    // 재해석하는데, 특정 환경(예: 경로에 '+' 문자가 포함된 경우)에서 존재하는
    // 파일도 못 찾는 것으로 오판하는 문제가 있어 직접 스트리밍한다.
    res.setHeader(
      "Content-Type",
      MIME_TYPES[ext] || "application/octet-stream",
    );
    res.setHeader("Content-Disposition", contentDisposition(displayFileName));
    fs.createReadStream(filePath).pipe(res);
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

    if (aiInFlightEnrollmentIds.has(Number(enrollmentId))) {
      return res
        .status(409)
        .json({ message: "AI 검증이 진행 중입니다. 잠시 후 다시 시도하세요." });
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

// (부서담당 이상) AI 검증 재실행
// POST /api/enrollments/:enrollmentId/reverify
router.post("/:enrollmentId/reverify", authenticateToken, async (req, res) => {
  const { enrollmentId } = req.params;
  const numericEnrollmentId = Number(enrollmentId);

  if (req.user.role < roles["부서담당"]) {
    return res.status(403).json({ message: "재검증 권한이 없습니다." });
  }

  // 동일 건에 대한 동시 AI 검증(제출 시 자동 실행된 백그라운드 검증 포함, 중복 유료
  // API 호출/결과 덮어쓰기)을 막는다.
  if (aiInFlightEnrollmentIds.has(numericEnrollmentId)) {
    return res
      .status(409)
      .json({ message: "이미 AI 검증이 진행 중입니다." });
  }
  aiInFlightEnrollmentIds.add(numericEnrollmentId);

  try {
    const enrollment = db
      .prepare(
        "SELECT id, user_id, course_id, state, stored_file_name FROM enrollments WHERE id = ?",
      )
      .get(enrollmentId);

    if (!enrollment || enrollment.state !== 2 || !enrollment.stored_file_name) {
      return res
        .status(404)
        .json({ message: "재검증할 제출내역을 찾을 수 없습니다." });
    }

    if (!canAccessEnrollment(enrollment, req.user)) {
      return res.status(403).json({ message: "재검증 권한이 없습니다." });
    }

    const filePath = path.join(uploadDir, enrollment.stored_file_name);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "파일을 찾을 수 없습니다." });
    }

    const course = db
      .prepare("SELECT name, year FROM courses WHERE id = ?")
      .get(enrollment.course_id);
    const owner = db
      .prepare("SELECT name FROM users WHERE id = ?")
      .get(enrollment.user_id);

    const ext = path.extname(enrollment.stored_file_name);
    const aiResult = await verifyCertificate({
      fileBuffer: fs.readFileSync(filePath),
      mimeType: MIME_TYPES[ext] || "application/octet-stream",
      courseName: course?.name ?? "",
      submitterName: owner?.name ?? "",
      courseYear: course?.year ?? new Date().getFullYear(),
    });

    const aiVerification = aiResult ? JSON.stringify(aiResult) : null;
    const aiFlagged = isAiFlagged(aiResult) ? 1 : 0;

    // 재검증 도중 해당 건이 삭제되었다면 대상 행이 없어 changes가 0이 된다.
    // 그 경우 이미 유료 AI 호출을 마쳤더라도 결과를 저장할 곳이 없으므로 정직하게 알린다.
    const updateResult = db
      .prepare(
        "UPDATE enrollments SET ai_verification = ?, ai_flagged = ? WHERE id = ?",
      )
      .run(aiVerification, aiFlagged, enrollment.id);

    if (updateResult.changes === 0) {
      return res.status(404).json({
        message: "재검증 중 해당 제출내역이 삭제되어 결과를 저장하지 못했습니다.",
      });
    }

    res.json({
      message: aiResult
        ? "재검증이 완료되었습니다."
        : "AI 검증을 수행하지 못했습니다.",
      ai_verified: Boolean(aiResult),
      ai_flagged: aiFlagged,
      ai_reasoning: aiResult?.reasoning ?? null,
      aiSkipReason: !aiResult && !isAiConfigured() ? "missing_api_key" : null,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "재검증 중 오류가 발생했습니다." });
  } finally {
    aiInFlightEnrollmentIds.delete(numericEnrollmentId);
  }
});

export default router;
