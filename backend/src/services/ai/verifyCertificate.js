import { verifyCertificateWithOpenAI } from "./providers/openaiVerifier.js";
import { verifyCertificateWithClaude } from "./providers/claudeVerifier.js";
import { getSetting } from "../../utils/settings.js";

// 새 provider를 추가할 때는 같은 시그니처의 verify 함수와 isConfigured를 만들어
// 여기에 한 항목만 등록하면 된다("openai"/"claude" 두 곳에 분기를 늘릴 필요 없음).
const PROVIDERS = {
  openai: {
    verify: verifyCertificateWithOpenAI,
    isConfigured: () =>
      Boolean(getSetting("ai_openai_api_key") || process.env.OPENAI_API_KEY),
  },
  claude: {
    verify: verifyCertificateWithClaude,
    isConfigured: () =>
      Boolean(
        getSetting("ai_anthropic_api_key") || process.env.ANTHROPIC_API_KEY,
      ),
  },
};

// 설정 화면(DB settings 테이블)에 값이 있으면 그 값을 쓰고, 없으면 .env 값으로 폴백한다.
export function getAiProvider() {
  return getSetting("ai_provider") || process.env.AI_PROVIDER || "openai";
}

// 현재 선택된 provider에 API 키가 설정되어 있는지 확인한다.
// 검증 결과가 null일 때, 단순 실패인지 키 미설정 때문인지 구분하는 용도로 쓰인다.
export function isAiConfigured() {
  return PROVIDERS[getAiProvider()]?.isConfigured() ?? false;
}

export async function verifyCertificate({
  fileBuffer,
  mimeType,
  courseName,
  submitterName,
  courseYear,
  exampleTitles,
}) {
  const providerName = getAiProvider();
  const provider = PROVIDERS[providerName];
  if (!provider) {
    console.warn(`알 수 없는 AI_PROVIDER: ${providerName}`);
    return null;
  }

  try {
    return await provider.verify({
      fileBuffer,
      mimeType,
      courseName,
      submitterName,
      courseYear,
      exampleTitles,
    });
  } catch (error) {
    console.error("AI 수료증 검증 실패:", error);
    return null;
  }
}

// 판단 기준 중 하나라도 걸리면 담당자 확인이 필요하다고 표시한다.
export function isAiFlagged(aiResult) {
  if (!aiResult) return false;
  return Boolean(
    !aiResult.isCertificate ||
      !aiResult.hasRequiredTitle ||
      !aiResult.nameMatches ||
      !aiResult.courseMatches ||
      !aiResult.hasIssuingInstitution ||
      !aiResult.issueDateValid,
  );
}
