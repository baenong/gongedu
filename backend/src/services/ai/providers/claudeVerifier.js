import Anthropic from "@anthropic-ai/sdk";
import { toImageBase64 } from "../pdfToImage.js";

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    isCertificate: { type: "boolean" },
    extractedRecipientName: { type: ["string", "null"] },
    extractedCourseName: { type: ["string", "null"] },
    nameMatches: { type: "boolean" },
    courseMatches: { type: "boolean" },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    reasoning: { type: "string" },
  },
  required: [
    "isCertificate",
    "extractedRecipientName",
    "extractedCourseName",
    "nameMatches",
    "courseMatches",
    "confidence",
    "reasoning",
  ],
  additionalProperties: false,
};

export async function verifyCertificateWithClaude({
  fileBuffer,
  mimeType,
  courseName,
  submitterName,
}) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("ANTHROPIC_API_KEY가 설정되지 않아 AI 검증을 건너뜁니다.");
    return null;
  }

  const image = await toImageBase64(fileBuffer, mimeType);
  if (!image) return null;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5",
    max_tokens: 1024,
    output_config: {
      format: { type: "json_schema", schema: RESPONSE_SCHEMA },
    },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: image.mimeType,
              data: image.base64,
            },
          },
          {
            type: "text",
            text:
              `이 파일이 "${courseName}" 교육과정의 수료증/이수증이 맞고, ` +
              `수료자 이름이 "${submitterName}"과 일치하는지 확인해주세요. ` +
              "이미지에서 읽은 내용을 근거로만 판단하세요.",
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock) return null;
  return JSON.parse(textBlock.text);
}
