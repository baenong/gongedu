// AI 수료증 검증이 실제 API를 호출해 올바르게 판단하는지 눈으로 확인하기 위한
// 수동 실행용 스크립트입니다. 실제 유료 API 호출이 발생하므로 npm test(vitest)에는
// 포함하지 않았고, 필요할 때 직접 실행합니다.
//
//   backend/.env 에 OPENAI_API_KEY 또는 ANTHROPIC_API_KEY, AI_PROVIDER 설정 후
//   node scripts/test-ai-verification.js
//
// TEST_CASES의 courseName/submitterName/courseYear는 실제 테스트 수료증에 적힌
// 내용과 맞춰서 수정한 뒤 실행하세요(정답을 알아야 courseMatches/nameMatches 등을
// 의미 있게 평가할 수 있습니다).

import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  verifyCertificate,
  isAiFlagged,
} from "../src/services/ai/verifyCertificate.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDataDir = path.join(__dirname, "../.test-data/ai-test");

const MIME_TYPES = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

// TODO: 실제 테스트 수료증 내용에 맞게 수정하세요.
const TEST_CASES = [
  {
    file: "correct01.pdf",
    courseName: "성인지교육",
    submitterName: "안민수",
    courseYear: 2026,
    expectFlagged: false,
  },
  {
    file: "correct02.pdf",
    courseName: "긴급복지 신고의무교육",
    submitterName: "안민수",
    courseYear: 2026,
    expectFlagged: false,
  },
  {
    file: "incorrect01.pdf",
    courseName: "인권교육",
    submitterName: "안민수",
    courseYear: 2026,
    expectFlagged: true,
  },
  {
    file: "incorrect02.pdf",
    courseName: "인권교육",
    submitterName: "안민수",
    courseYear: 2026,
    expectFlagged: true,
  },
];

async function runCase({
  file,
  courseName,
  submitterName,
  courseYear,
  expectFlagged,
}) {
  const filePath = path.join(testDataDir, file);
  console.log(`\n${"=".repeat(60)}`);
  console.log(`파일: ${file}`);
  console.log(
    `대상 과정: "${courseName}" / 대상자: "${submitterName}" / 연도: ${courseYear}`,
  );

  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  건너뜀 - 파일을 찾을 수 없습니다: ${filePath}`);
    return { file, skipped: true };
  }

  const ext = path.extname(file).toLowerCase();
  const fileBuffer = fs.readFileSync(filePath);

  const start = Date.now();
  const aiResult = await verifyCertificate({
    fileBuffer,
    mimeType: MIME_TYPES[ext] || "application/octet-stream",
    courseName,
    submitterName,
    courseYear,
  });
  const elapsedMs = Date.now() - start;

  if (!aiResult) {
    console.log(
      `❌ AI 검증이 null을 반환했습니다 (API 키 미설정 또는 호출 실패). ${elapsedMs}ms`,
    );
    return { file, skipped: true };
  }

  const flagged = isAiFlagged(aiResult);
  const pass = flagged === expectFlagged;

  console.log(`응답 (${elapsedMs}ms):`);
  console.log(JSON.stringify(aiResult, null, 2));
  console.log(
    `${pass ? "✅ PASS" : "❌ FAIL"} - flagged=${flagged} (기대값: ${expectFlagged})`,
  );

  return { file, pass, flagged, expectFlagged };
}

async function main() {
  const results = [];
  for (const testCase of TEST_CASES) {
    results.push(await runCase(testCase));
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("요약");
  for (const r of results) {
    if (r.skipped) {
      console.log(`- ${r.file}: 건너뜀`);
    } else {
      console.log(`- ${r.file}: ${r.pass ? "PASS" : "FAIL"}`);
    }
  }

  const skipped = results.filter((r) => r.skipped);
  const failed = results.filter((r) => !r.skipped && !r.pass);
  if (skipped.length === results.length) {
    console.log("\n⚠️  전부 건너뜀 - API 키 설정과 파일 경로를 확인하세요.");
    process.exitCode = 1;
  } else if (failed.length > 0) {
    console.log(`\n${failed.length}건 실패`);
    process.exitCode = 1;
  } else {
    console.log("\n모두 통과");
  }
}

main().catch((error) => {
  console.error("스크립트 실행 중 오류:", error);
  process.exitCode = 1;
});
