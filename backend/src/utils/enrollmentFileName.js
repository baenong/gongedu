// 파일명에서 특수문자 제거
export const sanitizeFilename = (name) => {
  return String(name)
    .replace(/[\\/:*?"<>|]/g, "")
    .trim();
};

// 조회/다운로드 시점의 "현재" 부서·팀·이름·교육명으로 표시용 파일명을 조합한다.
// 디스크 저장 파일명(opaque)과는 별개이며, 항상 최신 값 기준으로 새로 계산해야 한다.
export const buildDisplayFileName = ({ department, team, name, courseName, ext }) => {
  const cleanDept = sanitizeFilename(department);
  const cleanCourse = sanitizeFilename(courseName);
  const cleanTeam = sanitizeFilename(team);
  const cleanName = sanitizeFilename(name);
  return `[${cleanDept}] ${cleanCourse}_${cleanTeam}_${cleanName}${ext}`;
};
