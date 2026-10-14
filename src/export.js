// CSV and JSON export of approved fields, in data-dictionary order.

import { FIELDS, FIELD_NAMES } from "./data-dictionary.js";

function csvCell(value) {
  if (value === undefined || value === null) return "";
  let s = String(value);
  // Neutralize spreadsheet formula injection in free text.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCSV(records) {
  const lines = [FIELD_NAMES.join(",")];
  for (const r of records) {
    lines.push(FIELD_NAMES.map((n) => csvCell(r[n])).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}

export function toJSON(records, meta = {}) {
  const ordered = records.map((r) => {
    const o = {};
    for (const n of FIELD_NAMES) o[n] = r[n];
    return o;
  });
  return JSON.stringify({ ...meta, count: ordered.length, records: ordered }, null, 2);
}

export function dictionaryToCSV() {
  const header = ["field", "type", "allowed_values", "special_codes", "measure", "description"];
  const lines = [header.join(",")];
  for (const f of FIELDS) {
    lines.push(
      [
        f.name,
        f.type,
        (f.values || []).join("|"),
        (f.special || []).join("|"),
        f.measure || "",
        f.description,
      ]
        .map(csvCell)
        .join(",")
    );
  }
  return lines.join("\r\n") + "\r\n";
}

export function downloadText(filename, text, mime = "text/plain") {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
