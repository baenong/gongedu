import { toImageBase64 } from "../pdfToImage.js";
import { getSetting } from "../../../utils/settings.js";
import {
  CERTIFICATE_VERIFICATION_SCHEMA,
  buildVerificationInstruction,
} from "../certificateSchema.js";

const DEFAULT_BASE_URL = "http://127.0.0.1:11434";
const DEFAULT_MODEL = "qwen2.5vl:3b";

export function getLocalLlmBaseUrl() {
  return (
    getSetting("ai_local_base_url") ||
    process.env.LOCAL_LLM_BASE_URL ||
    DEFAULT_BASE_URL
  );
}

// Ollama의 네이티브 /api/chat을 사용한다. format에 JSON 스키마를 그대로 넘기면
// 다른 provider와 동일하게 구조화된 응답을 강제할 수 있어, 모델을 바꾸더라도
// 이 함수(=ollama와 소통하는 인터페이스)만 그대로 두면 된다.
export async function verifyCertificateWithLocal({
  fileBuffer,
  mimeType,
  courseName,
  submitterName,
  courseYear,
  exampleTitles,
}) {
  const baseUrl = getLocalLlmBaseUrl();
  const model =
    getSetting("ai_local_model") || process.env.LOCAL_LLM_MODEL || DEFAULT_MODEL;

  const image = await toImageBase64(fileBuffer, mimeType);
  if (!image) return null;

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      format: CERTIFICATE_VERIFICATION_SCHEMA,
      messages: [
        {
          role: "user",
          content: buildVerificationInstruction({
            courseName,
            submitterName,
            courseYear,
            exampleTitles,
          }),
          images: [image.base64],
        },
      ],
    }),
  });

  if (!response.ok) {
    console.error(
      `로컬 LLM(Ollama) AI 검증 실패: ${response.status} ${await response.text()}`,
    );
    return null;
  }

  const data = await response.json();
  const content = data?.message?.content;
  if (!content) return null;
  return JSON.parse(content);
}
