// Data dictionary for AgeCheck Study records.
//
// This is the single source of truth for which fields a record may contain,
// what each value means, and how "not reached", "skipped", and "missing"
// are coded. The participant app builds records from it, the reference
// server validates submissions against it, and the researcher dashboard
// renders it and uses it for CSV and JSON export.

export const SPECIAL = {
  NOT_REACHED: "not_reached", // the participant never saw this step or item
  SKIPPED: "skipped", // the item was shown and left unanswered
  MISSING: "missing", // the questionnaire was never submitted
  NOT_APPLICABLE: "not_applicable", // the item does not apply to this pathway
  DISABLED: "disabled", // the item is turned off in the study configuration
  NOT_COLLECTED: "not_collected", // the field is turned off in the study configuration
  WITHHELD: "withheld", // collected, then removed under the withdrawal policy
};

export const CONDITIONS = ["advance_notice", "later_notice"];

export const PATHWAYS = [
  "declined_before_check",
  "stopped_at_id_request",
  "would_continue_with_id",
  "incomplete_session",
  "withdrawn",
];

export const PATHWAY_LABELS = {
  declined_before_check: "Declined before simulated check",
  stopped_at_id_request: "Started check and stopped at ID request",
  would_continue_with_id: "Started check and would continue with ID",
  incomplete_session: "Incomplete session",
  withdrawn: "Withdrawn from study",
};

export const CONDITION_LABELS = {
  advance_notice: "Advance notice",
  later_notice: "Later notice",
};

export const RECORD_KINDS = ["research", "preview_walkthrough", "synthetic_demo"];

export const STEPS = [
  "intro",
  "eligibility",
  "consent",
  "scenario",
  "verification",
  "simulation",
  "result",
  "confirmation",
  "questionnaire",
  "debrief",
  "finished",
];

const LIKERT = ["1", "2", "3", "4", "5"];
const YNS_P = ["yes", "no", "not_sure", "prefer_not"];

/**
 * Field definitions in export order.
 *   type:   "string" | "enum" | "integer" | "text" | "multi"
 *   values: allowed values for enum/multi (special codes listed separately)
 *   special: allowed special codes
 */
export const FIELDS = [
  {
    name: "response_id",
    type: "string",
    description: "Random identifier (UUID v4) generated when the participant gave assent. Not derived from any personal information.",
  },
  {
    name: "response_code",
    type: "string",
    description: "Short code shown at the debrief, derived from response_id. A participant can request deletion with this code alone.",
  },
  {
    name: "record_kind",
    type: "enum",
    values: RECORD_KINDS,
    description: "research = real participant record in research mode. preview_walkthrough = a run of the app in preview mode. synthetic_demo = generated demo data. Demo and research records are stored separately and never mixed.",
  },
  {
    name: "study_version",
    type: "string",
    description: "Version of the study configuration the participant saw. Frozen when research mode is activated.",
  },
  {
    name: "condition",
    type: "enum",
    values: CONDITIONS,
    description: "Assigned notice condition. advance_notice = the possible ID requirement was disclosed before the simulated check. later_notice = it was disclosed only after the uncertain result.",
  },
  {
    name: "assignment_method",
    type: "enum",
    values: ["random", "forced_preview"],
    description: "random = assigned by the app's random draw (about 1:1). forced_preview = set with a URL parameter, which only works in preview mode.",
  },
  {
    name: "assigned_screen_displayed",
    type: "enum",
    values: ["yes", "no"],
    description: "Whether the verification screen for the assigned condition was rendered to the participant.",
  },
  {
    name: "initial_decision",
    type: "enum",
    values: ["start", "decline"],
    special: [SPECIAL.NOT_REACHED, SPECIAL.WITHHELD],
    description: "Choice on the verification screen. start = Start simulated check. decline = Decline verification. not_reached = the participant never reached that screen.",
  },
  {
    name: "reached_uncertain_result",
    type: "enum",
    values: ["yes", "no"],
    description: "Whether the scripted uncertain-result screen was shown.",
  },
  {
    name: "reached_id_prompt",
    type: "enum",
    values: ["yes", "no"],
    description: "Whether the government-ID prompt was shown. Identical to reached_uncertain_result in this design because both appear on the same screen; kept separate for clarity.",
  },
  {
    name: "id_decision",
    type: "enum",
    values: ["continue", "stop"],
    special: [SPECIAL.NOT_REACHED, SPECIAL.WITHHELD],
    description: "Choice at the ID prompt. continue = I would continue with ID verification. stop = I would stop here. not_reached = never saw the prompt. Never code a participant who did not reach the prompt as having declined ID verification.",
  },
  {
    name: "final_pathway",
    type: "enum",
    values: PATHWAYS,
    description: "Summary of the verification choices. withdrawn takes precedence over everything else. incomplete_session = the session ended before an initial decision, or after starting the check but before an ID decision.",
  },
  {
    name: "withdrawn_at_step",
    type: "enum",
    values: STEPS,
    special: [SPECIAL.NOT_APPLICABLE],
    description: "The step the participant was on when they chose Withdraw from study. not_applicable if they did not withdraw.",
  },
  {
    name: "submission_status",
    type: "enum",
    values: ["in_progress", "submitted", "withdrawn"],
    description: "in_progress = record created at assent and not yet submitted. submitted = questionnaire submitted. withdrawn = participant withdrew.",
  },
  {
    name: "questionnaire_status",
    type: "enum",
    values: ["submitted", "missing"],
    description: "submitted = the questionnaire was submitted (individual items may still be skipped). missing = never submitted.",
  },
  {
    name: "q_risk_exposure",
    type: "enum",
    values: LIKERT,
    special: [SPECIAL.SKIPPED, SPECIAL.MISSING, SPECIAL.WITHHELD],
    measure: "perceived_privacy_risk",
    description: "Agreement (1 strongly disagree to 5 strongly agree): I would be concerned that information requested during this process could be exposed in a security incident.",
  },
  {
    name: "q_risk_misuse",
    type: "enum",
    values: LIKERT,
    special: [SPECIAL.SKIPPED, SPECIAL.MISSING, SPECIAL.WITHHELD],
    measure: "perceived_privacy_risk",
    description: "Agreement: I would be concerned that information requested during this process could be used for purposes I did not expect.",
  },
  {
    name: "q_risk_feel",
    type: "enum",
    values: LIKERT,
    special: [SPECIAL.SKIPPED, SPECIAL.MISSING, SPECIAL.WITHHELD],
    measure: "perceived_privacy_risk",
    description: "Agreement: Providing the information requested during this process would feel risky to me.",
  },
  {
    name: "q_transp_explained",
    type: "enum",
    values: LIKERT,
    special: [SPECIAL.SKIPPED, SPECIAL.MISSING, SPECIAL.WITHHELD],
    measure: "perceived_transparency",
    description: "Agreement: The platform clearly explained what the verification process could involve.",
  },
  {
    name: "q_transp_expect",
    type: "enum",
    values: LIKERT,
    special: [SPECIAL.SKIPPED, SPECIAL.MISSING, SPECIAL.WITHHELD],
    measure: "perceived_transparency",
    description: "Agreement: I knew what to expect from the process before deciding whether to start.",
  },
  {
    name: "q_id_unexpected",
    type: "enum",
    values: LIKERT,
    special: [SPECIAL.SKIPPED, SPECIAL.MISSING, SPECIAL.NOT_REACHED, SPECIAL.WITHHELD],
    measure: "unexpectedness",
    description: "Agreement: The government-ID request was unexpected. Asked only of participants who reached the ID prompt; not_reached otherwise.",
  },
  {
    name: "q_id_understood",
    type: "enum",
    values: LIKERT,
    special: [SPECIAL.SKIPPED, SPECIAL.MISSING, SPECIAL.NOT_REACHED, SPECIAL.WITHHELD],
    measure: "unexpectedness",
    description: "Agreement: Before starting the facial check, I understood that a government ID might be requested. Asked only of participants who reached the ID prompt.",
  },
  {
    name: "q_recall_notice",
    type: "enum",
    values: ["yes", "no", "not_sure", "did_not_start"],
    special: [SPECIAL.SKIPPED, SPECIAL.MISSING, SPECIAL.WITHHELD],
    measure: "notice_recall",
    description: "Before the simulated facial check began, did the screen mention that a government ID might be requested?",
  },
  {
    name: "q_prior_experience",
    type: "enum",
    values: YNS_P,
    special: [SPECIAL.SKIPPED, SPECIAL.MISSING, SPECIAL.WITHHELD],
    description: "Have you previously encountered an online age-verification process?",
  },
  {
    name: "q_id_availability",
    type: "enum",
    values: YNS_P,
    special: [SPECIAL.SKIPPED, SPECIAL.MISSING, SPECIAL.WITHHELD],
    description: "Would you have access to an acceptable government-issued ID if a real platform requested one? The document type is never asked.",
  },
  {
    name: "q_breach_awareness",
    type: "enum",
    values: YNS_P,
    special: [SPECIAL.SKIPPED, SPECIAL.MISSING, SPECIAL.WITHHELD],
    description: "Before this study, had you heard about a security incident involving identity documents submitted for online age-related checks?",
  },
  {
    name: "q_open_influence",
    type: "text",
    maxLength: 1000,
    special: [SPECIAL.SKIPPED, SPECIAL.MISSING, SPECIAL.WITHHELD],
    description: "Free text: What most influenced your decision to continue or stop? Review for accidental personal details before sharing exports.",
  },
  {
    name: "q_stop_reasons",
    type: "multi",
    values: [
      "privacy_security",
      "no_id_available",
      "too_much_effort",
      "unexpected_request",
      "feature_not_important",
      "other",
      "prefer_not",
    ],
    special: [SPECIAL.SKIPPED, SPECIAL.MISSING, SPECIAL.NOT_APPLICABLE, SPECIAL.WITHHELD],
    description: "Reasons selected by participants who declined or stopped, separated by semicolons. not_applicable for participants who would continue or who made no decision.",
  },
  {
    name: "q_demo_gender",
    type: "enum",
    values: ["woman", "man", "nonbinary", "self_describe", "prefer_not"],
    special: [SPECIAL.SKIPPED, SPECIAL.MISSING, SPECIAL.DISABLED, SPECIAL.WITHHELD],
    description: "Optional gender item. disabled unless demographics are enabled in the approved configuration.",
  },
  {
    name: "q_demo_race",
    type: "enum",
    values: [
      "asian",
      "black",
      "hispanic",
      "middle_eastern",
      "native",
      "pacific",
      "white",
      "multiple",
      "self_describe",
      "prefer_not",
    ],
    special: [SPECIAL.SKIPPED, SPECIAL.MISSING, SPECIAL.DISABLED, SPECIAL.WITHHELD],
    description: "Optional race or ethnicity item. disabled unless demographics are enabled in the approved configuration.",
  },
  {
    name: "ms_consent_to_assent",
    type: "integer",
    special: [SPECIAL.NOT_REACHED, SPECIAL.WITHHELD],
    description: "Milliseconds from the study-information screen appearing to the participant giving assent.",
  },
  {
    name: "ms_verification_to_initial_decision",
    type: "integer",
    special: [SPECIAL.NOT_REACHED, SPECIAL.WITHHELD],
    description: "Milliseconds from the verification screen appearing to the start or decline choice. This is a decision time, not a completion time.",
  },
  {
    name: "ms_simulation_duration",
    type: "integer",
    special: [SPECIAL.NOT_REACHED, SPECIAL.WITHHELD],
    description: "Milliseconds the simulated check was displayed. Scripted to about 3000 for everyone; recorded so the fixed timing can be verified.",
  },
  {
    name: "ms_result_to_id_decision",
    type: "integer",
    special: [SPECIAL.NOT_REACHED, SPECIAL.WITHHELD],
    description: "Milliseconds from the uncertain-result and ID-prompt screen appearing to the continue or stop choice. A decision time, not a completion time.",
  },
  {
    name: "ms_questionnaire_duration",
    type: "integer",
    special: [SPECIAL.NOT_REACHED, SPECIAL.WITHHELD],
    description: "Milliseconds from the questionnaire appearing to submission.",
  },
  {
    name: "recruitment_code",
    type: "string",
    maxLength: 16,
    special: [SPECIAL.NOT_COLLECTED, SPECIAL.SKIPPED, SPECIAL.WITHHELD],
    description: "Recruitment code, only if enabled and approved. Must not contain names or student IDs. not_collected when the field is off.",
  },
];

export const FIELD_NAMES = FIELDS.map((f) => f.name);

/** Validate a record against the dictionary. Returns a list of problems. */
export function validateRecord(record) {
  const problems = [];
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return ["record must be an object"];
  }
  for (const key of Object.keys(record)) {
    if (!FIELD_NAMES.includes(key)) problems.push(`unknown field: ${key}`);
  }
  for (const f of FIELDS) {
    const v = record[f.name];
    if (v === undefined || v === null) {
      problems.push(`missing field: ${f.name}`);
      continue;
    }
    const special = f.special || [];
    if (typeof v === "string" && special.includes(v)) continue;
    switch (f.type) {
      case "string":
        if (typeof v !== "string" || v.length === 0 || v.length > (f.maxLength || 64)) {
          problems.push(`invalid string for ${f.name}`);
        }
        break;
      case "enum":
        if (!f.values.includes(String(v))) problems.push(`invalid value for ${f.name}: ${v}`);
        break;
      case "integer":
        if (!Number.isInteger(v) || v < 0 || v > 86_400_000) problems.push(`invalid integer for ${f.name}`);
        break;
      case "text":
        if (typeof v !== "string" || v.length > (f.maxLength || 1000)) problems.push(`invalid text for ${f.name}`);
        break;
      case "multi": {
        if (typeof v !== "string") {
          problems.push(`invalid multi for ${f.name}`);
          break;
        }
        const parts = v.split(";").filter(Boolean);
        if (parts.length === 0) problems.push(`empty multi for ${f.name}`);
        for (const p of parts) {
          if (!f.values.includes(p)) problems.push(`invalid value in ${f.name}: ${p}`);
        }
        break;
      }
      default:
        problems.push(`unknown type for ${f.name}`);
    }
  }
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  if (typeof record.response_id === "string" && !uuid.test(record.response_id)) {
    problems.push("response_id is not a UUID v4");
  }
  if (typeof record.response_code === "string" && !/^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(record.response_code)) {
    problems.push("response_code has the wrong shape");
  }
  return problems;
}
