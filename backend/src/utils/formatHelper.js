const getKSTDate = () => new Date(Date.now() + 9 * 60 * 60 * 1000);

export const getCurrentKST = () => {
  const kst = getKSTDate();
  return kst.toISOString().replace("T", " ").substring(0, 19);
};

export const getFormattedTime = () => {
  const kst = getKSTDate();
  const yyyy = kst.getUTCFullYear();
  const mm = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(kst.getUTCDate()).padStart(2, "0");
  const hh = String(kst.getUTCHours()).padStart(2, "0");
  const min = String(kst.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}${mm}${dd}_${hh}${min}`;
};
