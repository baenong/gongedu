import OpenAI from "openai";
import { pdfToPng } from "pdf-to-png-converter";

const RESPONSE_SCHEMA = {
  name: "certificate_verification",
  strict: true,
  schema: {
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
  },
};

// PDF는 Chat Completions의 image_url로 바로 넣을 수 없으므로 첫 페이지를 PNG로 변환한다.
async function toImageBase64(fileBuffer, mimeType) {
  if (mimeType === "application/pdf") {
    const pages = await pdfToPng(fileBuffer, { pagesToProcess: [1] });
    if (!pages[0]) return null;
    return { base64: pages[0].content.toString("base64"), mimeType: "image/png" };
  }
  return { base64: fileBuffer.toString("base64"), mimeType };
}

export async function verifyCertificateWithOpenAI({
  fileBuffer,
  mimeType,
  courseName,
  submitterName,
}) {
  if (!process.env.OPENAI_API_KEY) {
    console.warn("OPENAI_API_KEY가 설정되지 않아 AI 검증을 건너뜁니다.");
    return null;
  }

  const image = await toImageBase64(fileBuffer, mimeType);
  if (!image) return null;

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o",
    response_format: { type: "json_schema", json_schema: RESPONSE_SCHEMA },
    messages: [
      {
        role: "system",
        content:
          "당신은 제출된 파일이 교육 수료증/이수증이 맞는지, 특정 교육과 관련이 있는지, " +
          "특정 사람의 명의가 맞는지 판단하는 검증 도우미입니다. 이미지에서 읽은 내용을 근거로만 판단하세요.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              `이 파일이 "${courseName}" 교육과정의 수료증/이수증이 맞고, ` +
              `수료자 이름이 "${submitterName}"과 일치하는지 확인해주세요.`,
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
