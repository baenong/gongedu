import { pdfToPng } from "pdf-to-png-converter";

// PDF는 vision API에 바로 넣을 수 없는 경우가 많아 첫 페이지를 PNG로 변환한다.
// 이미지(jpg/png)는 변환 없이 그대로 base64로 반환한다.
export async function toImageBase64(fileBuffer, mimeType) {
  if (mimeType === "application/pdf") {
    const pages = await pdfToPng(fileBuffer, { pagesToProcess: [1] });
    if (!pages[0]) return null;
    return {
      base64: pages[0].content.toString("base64"),
      mimeType: "image/png",
    };
  }
  return { base64: fileBuffer.toString("base64"), mimeType };
}
