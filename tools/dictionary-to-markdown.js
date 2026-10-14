// Regenerates docs/DATA_DICTIONARY.md from src/data-dictionary.js.
// Run: node tools/dictionary-to-markdown.js

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FIELDS, SPECIAL, PATHWAY_LABELS, CONDITION_LABELS } from "../src/data-dictionary.js";

const out = [];
out.push("# Data dictionary");
out.push("");
out.push("Generated from `src/data-dictionary.js`, which the participant app, the reference server, and the researcher dashboard all import. Regenerate with `node tools/dictionary-to-markdown.js` after changing that file.");
out.push("");
out.push("One record per participant who gave assent. Nothing is stored for visitors who were ineligible or did not agree to take part.");
out.push("");
out.push("## Special codes");
out.push("");
out.push("| Code | Meaning |");
out.push("|---|---|");
out.push(`| \`${SPECIAL.NOT_REACHED}\` | The participant never saw this step or item. |`);
out.push(`| \`${SPECIAL.SKIPPED}\` | The item was shown and left unanswered. |`);
out.push(`| \`${SPECIAL.MISSING}\` | The questionnaire was never submitted. |`);
out.push(`| \`${SPECIAL.NOT_APPLICABLE}\` | The item does not apply to this pathway. |`);
out.push(`| \`${SPECIAL.DISABLED}\` | The item is turned off in the study configuration. |`);
out.push(`| \`${SPECIAL.NOT_COLLECTED}\` | The field is turned off in the study configuration. |`);
out.push(`| \`${SPECIAL.WITHHELD}\` | Collected, then removed under the withdrawal policy. |`);
out.push("");
out.push("A participant who never reached the ID prompt has `id_decision = not_reached`. They are never coded as having declined ID verification.");
out.push("");
out.push("## Conditions");
out.push("");
for (const [k, v] of Object.entries(CONDITION_LABELS)) out.push(`- \`${k}\`: ${v}`);
out.push("");
out.push("## Final pathways");
out.push("");
for (const [k, v] of Object.entries(PATHWAY_LABELS)) out.push(`- \`${k}\`: ${v}`);
out.push("");
out.push("`withdrawn` takes precedence over every other pathway. `incomplete_session` covers a session that ended before an initial decision, or after starting the check but before an ID decision. The questionnaire's own state is in `questionnaire_status`, separate from the pathway.");
out.push("");
out.push("## Fields (export order)");
out.push("");
out.push("| Field | Type | Allowed values | Special codes | Measure | Meaning |");
out.push("|---|---|---|---|---|---|");
for (const f of FIELDS) {
  const values = (f.values || []).map((v) => `\`${v}\``).join(", ");
  const special = (f.special || []).map((v) => `\`${v}\``).join(", ");
  out.push(`| \`${f.name}\` | ${f.type}${f.maxLength ? ` (max ${f.maxLength})` : ""} | ${values} | ${special} | ${f.measure || ""} | ${f.description.replace(/\|/g, "\\|")} |`);
}
out.push("");
out.push("## Measures");
out.push("");
out.push("Perceived privacy risk (`q_risk_*`), perceived transparency (`q_transp_*`), unexpectedness (`q_id_*`), and notice recall (`q_recall_notice`) are stored item by item. The app computes no composite score, no reliability statistic, and no significance test. The questionnaire items are custom draft items written for this study, not a validated scale.");
out.push("");
out.push("## Timing");
out.push("");
out.push("Every `ms_*` field is a difference between two moments inside the session, in milliseconds. No absolute timestamp is stored in a record. `ms_verification_to_initial_decision` and `ms_result_to_id_decision` are decision times for whichever choice was made; they are not completion times.");
out.push("");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const target = path.join(__dirname, "..", "docs", "DATA_DICTIONARY.md");
fs.writeFileSync(target, out.join("\n"));
process.stdout.write(`wrote ${target}\n`);
