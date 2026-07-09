// OpenAI/Claude 두 provider가 동일한 기준으로 판단하도록 공유하는 구조화 출력 스키마.
export const CERTIFICATE_VERIFICATION_SCHEMA = {
  type: "object",
  properties: {
    isCertificate: { type: "boolean" },
    hasRequiredTitle: { type: "boolean" },
    extractedRecipientName: { type: ["string", "null"] },
    nameMatches: { type: "boolean" },
    extractedCourseName: { type: ["string", "null"] },
    courseMatches: { type: "boolean" },
    extractedIssuingInstitution: { type: ["string", "null"] },
    hasIssuingInstitution: { type: "boolean" },
    extractedIssueDate: { type: ["string", "null"] },
    issueDateValid: { type: "boolean" },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    reasoning: { type: "string" },
  },
  required: [
    "isCertificate",
    "hasRequiredTitle",
    "extractedRecipientName",
    "nameMatches",
    "extractedCourseName",
    "courseMatches",
    "extractedIssuingInstitution",
    "hasIssuingInstitution",
    "extractedIssueDate",
    "issueDateValid",
    "confidence",
    "reasoning",
  ],
  additionalProperties: false,
};

// 두 provider가 그대로 이어붙여 쓰는 공통 지시문.
export function buildVerificationInstruction({ courseName, submitterName, courseYear }) {
  return `이 파일이 "${submitterName}"님이 "${courseName}" 교육과정을 수료했다는 수료증/이수증이 맞는지 판단해주세요. 이미지에서 읽은 내용을 근거로만 판단하고, 다음 기준을 모두 확인하세요.

1. "수료증", "이수증", "교육수료증", "교육이수증" 등 수료/이수를 나타내는 문구가 있는지 (hasRequiredTitle)
2. 교육과정명이 적혀 있는지, 그리고 그 과정명이 등록된 과정과 관련 있는지 (courseMatches)
   - 등록된 과정명과 수료증에 적힌 과정명이 글자 그대로 똑같지 않아도 됩니다. 회차 표기(예: [2026-2기])나 부제가 생략/축약되었거나 표현이 다를 수 있습니다. 핵심 주제가 같으면 관련 있다고 판단하세요.
   - 예를 들어 등록된 과정이 "인권"을 주제로 한 교육이라면, 수료증 과정명이 "사회복지와 인권", "인권의 이해", "세계인권선언", "노인인권", "장애인차별금지법의 해설", "기후위기와 인권이야기"처럼 인권이라는 주제와 맥락상 연결되어 있으면 courseMatches를 true로 판단하되, 전혀 다른 주제라면 false로 판단하세요.
3. 수료자 이름이 적혀 있는지, 그리고 그 이름이 대상자 이름과 일치하는지 (nameMatches)
4. 교육을 발급한 기관명이 적혀 있는지 (hasIssuingInstitution)
5. 발급일자가 적혀 있다면 그 연도가 ${courseYear}년인지 (issueDateValid). 발급일자가 아예 없다면 issueDateValid는 false로 판단하세요.

reasoning 필드는 위 판단 근거를 요약한 것으로, 반드시 한국어로만 작성하세요.

대상 교육과정명: "${courseName}"
대상 수료자 이름: "${submitterName}"
기준 연도: ${courseYear}`;
}
