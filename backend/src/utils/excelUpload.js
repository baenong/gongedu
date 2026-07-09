import path from "path";
import { Readable } from "stream";
import ExcelJS from "exceljs";

// multer로 받은 엑셀/CSV 업로드 파일에서 첫 번째 워크시트를 읽어온다.
// 시트가 없으면 null을 반환한다.
export const loadUploadedWorksheet = async (file) => {
  const workbook = new ExcelJS.Workbook();
  const ext = path.extname(file.originalname).toLowerCase();

  if (ext === ".csv") {
    const stream = new Readable();
    stream.push(file.buffer);
    stream.push(null);
    await workbook.csv.read(stream);
  } else {
    await workbook.xlsx.load(file.buffer);
  }

  return workbook.worksheets[0] ?? null;
};
