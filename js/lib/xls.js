// Lee un .xls/.xlsx del navegador y devuelve la matriz de celdas. El archivo NO se sube a ningún servidor.
// SheetJS se carga solo cuando hace falta.
const SHEETJS = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('No se pudo cargar el lector de Excel. Revisa tu conexión.'));
    document.head.appendChild(s);
  });
}

export async function readSheet(file) {
  if (!window.XLSX) await loadScript(SHEETJS);
  const buf = await file.arrayBuffer();
  const wb = window.XLSX.read(buf, { type: 'array', cellDates: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  // raw: true -> importes como números y fechas tal cual vienen (texto dd/mm/aaaa)
  return window.XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null, blankrows: true });
}
