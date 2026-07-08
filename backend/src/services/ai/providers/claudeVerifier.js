import Anthropic from "@anthropic-ai/sdk";
import { toImageBase64 } from "../pdfToImage.js";
import { getSetting } from "../../../utils/settings.js";
import {
  CERTIFICATE_VERIFICATION_SCHEMA,
  buildVerificationInstruction,
} from "../certificateSchema.js";

export async function verifyCertificateWithClaude({
  fileBuffer,
  mimeType,
  courseName,
  submitterName,
  courseYear,
}) {
  const apiKey =
    getSetting("ai_anthropic_api_key") || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("ANTHROPIC_API_KEY가 설정되지 않아 AI 검증을 건너뜁니다.");
    return null;
  }

  const image = await toImageBase64(fileBuffer, mimeType);
  if (!image) return null;

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model:
      getSetting("ai_anthropic_model") ||
      process.env.ANTHROPIC_MODEL ||
      "claude-haiku-4-5",
    max_tokens: 1024,
    output_config: {
      format: { type: "json_schema", schema: CERTIFICATE_VERIFICATION_SCHEMA },
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
            text: buildVerificationInstruction({ courseName, submitterName, courseYear }),
          },
        ],
      },
    ],
  });

  if (response.stop_reason === "max_tokens") {
    console.error(
      "Claude AI 검증 응답이 max_tokens에 도달해 잘렸습니다. reasoning이 예상보다 길었을 수 있습니다.",
    );
    return null;
  }
  if (response.stop_reason === "refusal") {
    console.error("Claude가 AI 검증 요청을 거부했습니다(stop_reason: refusal).");
    return null;
  }

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock) return null;
  return JSON.parse(textBlock.text);
}
