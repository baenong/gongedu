import { verifyCertificateWithOpenAI } from "./providers/openaiVerifier.js";
import { verifyCertificateWithClaude } from "./providers/claudeVerifier.js";
import { getSetting } from "../../utils/settings.js";

// 설정 화면(DB settings 테이블)에 값이 있으면 그 값을 쓰고, 없으면 .env 값으로 폴백한다.
export function getAiProvider() {
  return getSetting("ai_provider") || process.env.AI_PROVIDER || "openai";
}

// 현재 선택된 provider에 API 키가 설정되어 있는지 확인한다.
// 검증 결과가 null일 때, 단순 실패인지 키 미설정 때문인지 구분하는 용도로 쓰인다.
export function isAiConfigured() {
  const provider = getAiProvider();
  if (provider === "openai")
    return Boolean(getSetting("ai_openai_api_key") || process.env.OPENAI_API_KEY);
  if (provider === "claude")
    return Boolean(
      getSetting("ai_anthropic_api_key") || process.env.ANTHROPIC_API_KEY,
    );
  return false;
}

// provider는 DB 설정(ai_provider) 우선, 없으면 AI_PROVIDER 환경변수로 선택한다 ("openai" | "claude").
// 로컬 sLLM 등 다른 방식을 추가할 때는 여기에 분기를 늘리고
// 같은 시그니처의 새 provider 모듈을 추가하면 된다.
export async function verifyCertificate({
  fileBuffer,
  mimeType,
  courseName,
  submitterName,
}) {
  const provider = getAiProvider();

  try {
    if (provider === "openai") {
      return await verifyCertificateWithOpenAI({
        fileBuffer,
        mimeType,
        courseName,
        submitterName,
      });
    }

    if (provider === "claude") {
      return await verifyCertificateWithClaude({
        fileBuffer,
        mimeType,
        courseName,
        submitterName,
      });
    }

    console.warn(`알 수 없는 AI_PROVIDER: ${provider}`);
    return null;
  } catch (error) {
    console.error("AI 수료증 검증 실패:", error);
    return null;
  }
}
