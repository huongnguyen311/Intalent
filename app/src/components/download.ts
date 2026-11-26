/** Saves a CSV in the browser; the BOM makes Excel read Vietnamese text as UTF-8. No-op where blobs are unavailable (tests). */
export function downloadCsv(fileName: string, csv: string): void {
  if (typeof URL.createObjectURL !== 'function') return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }));
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}
