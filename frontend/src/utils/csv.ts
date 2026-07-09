const escapeCsvCell = (cell: unknown) =>
  `"${String(cell ?? "").replace(/"/g, '""')}"`;

// 엑셀에서 한글이 깨지지 않도록 BOM(﻿)을 붙이고, 셀 값의 큰따옴표를 이스케이프해
// CSV Blob을 만든다.
export const buildCsvBlob = (
  headers: string[],
  rows: (string | number | null | undefined)[][],
): Blob => {
  const csvContent =
    "﻿" +
    [headers, ...rows]
      .map((row) => row.map(escapeCsvCell).join(","))
      .join("\n");

  return new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
};
