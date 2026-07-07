import { verifyCertificateWithOpenAI } from "./providers/openaiVerifier.js";
import { verifyCertificateWithClaude } from "./providers/claudeVerifier.js";

// AI_PROVIDER 환경변수로 구현체를 선택한다 ("openai" | "claude").
// 로컬 sLLM 등 다른 방식을 추가할 때는 여기에 분기를 늘리고
// 같은 시그니처의 새 provider 모듈을 추가하면 된다.
export async function verifyCertificate({
  fileBuffer,
  mimeType,
  courseName,
  submitterName,
}) {
  const provider = process.env.AI_PROVIDER || "openai";

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
