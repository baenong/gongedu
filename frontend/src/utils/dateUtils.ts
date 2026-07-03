// 날짜 문자열(YYYY-MM-DD)을 받아서 'YYYY-MM-DD (월)' 형식으로 변환
export const formatDateWithDay = (dateString: string) => {
  if (!dateString) return "";

  const date = new Date(dateString);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const dayName = days[date.getDay()];

  return `${dateString} (${dayName})`;
};

// 날짜 문자열(YYYY-MM-DD)을 짧은 'YY.MM.DD' 형식으로 변환
export const formatShortDate = (dateString: string) => {
  if (!dateString) return "";

  const [year, month, day] = dateString.split("-");
  return `${year.slice(2)}.${month}.${day}`;
};
