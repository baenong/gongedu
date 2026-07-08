import OpenAI from "openai";
import { toImageBase64 } from "../pdfToImage.js";
import { getSetting } from "../../../utils/settings.js";
import {
  CERTIFICATE_VERIFICATION_SCHEMA,
  buildVerificationInstruction,
} from "../certificateSchema.js";

const RESPONSE_SCHEMA = {
  name: "certificate_verification",
  strict: true,
  schema: CERTIFICATE_VERIFICATION_SCHEMA,
};

export async function verifyCertificateWithOpenAI({
  fileBuffer,
  mimeType,
  courseName,
  submitterName,
  courseYear,
}) {
  const apiKey = getSetting("ai_openai_api_key") || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("OPENAI_API_KEY가 설정되지 않아 AI 검증을 건너뜁니다.");
    return null;
  }

  const image = await toImageBase64(fileBuffer, mimeType);
  if (!image) return null;

  const client = new OpenAI({ apiKey });

  const response = await client.chat.completions.create({
    model: getSetting("ai_openai_model") || process.env.OPENAI_MODEL || "gpt-4o",
    // 조직 차원 Zero Data Retention 계약과 별개로, 이 호출이 distillation/평가용으로
    // OpenAI 쪽에 30일간 저장되지 않도록 명시적으로 저장을 끈다.
    store: false,
    response_format: { type: "json_schema", json_schema: RESPONSE_SCHEMA },
    messages: [
      {
        role: "system",
        content:
          "당신은 제출된 파일이 교육 수료증/이수증 형식에 맞는지, 특정 교육과 " +
          "맥락상 관련이 있는지, 특정 사람의 명의가 맞는지 판단하는 검증 도우미입니다.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: buildVerificationInstruction({ courseName, submitterName, courseYear }),
          },
          {
            type: "image_url",
            image_url: { url: `data:${image.mimeType};base64,${image.base64}` },
          },
        ],
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return null;
  return JSON.parse(content);
}
