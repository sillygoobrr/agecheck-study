// Versioned study configuration for AgeCheck Study.
//
// Everything a participant reads, and everything the researcher can change
// before collection, lives here. The researcher dashboard edits a copy of
// this object and freezes it when research mode is activated. Condition
// wording, the scenario, and the questionnaire are part of the versioned
// configuration and must not change once collection has started.
//
// Text in [SQUARE BRACKETS] is a placeholder. Research mode cannot be
// activated while any placeholder remains.

export const CONFIG_SCHEMA_VERSION = 1;

export const DEFAULT_STUDY_CONFIG = {
  schemaVersion: CONFIG_SCHEMA_VERSION,
  studyVersion: "1.0.0-draft",
  // "preview": synthetic and walkthrough records only, clearly marked.
  // "research": real collection, only after activation checks pass.
  mode: "preview",
  frozen: false,
  activatedOn: null,

  appName: "AgeCheck Study",
  platformName: "ConnectSpace",

  eligibility: {
    // Approved age range. Ages are collected as single-year categories,
    // never as a birth date.
    minAge: 16,
    maxAge: 17,
    recruitmentCriteriaText:
      "I was invited to take part through the approved Prosper-area recruitment process.",
    recruitmentCode: {
      enabled: false,
      label: "Recruitment code (only if you were given one)",
      help: "Codes never contain names or student IDs.",
      pattern: "^[A-Za-z0-9-]{3,16}$",
    },
    ineligibleMessage:
      "Thank you for your interest. This study is only open to participants who meet its approved eligibility requirements, so it ends here. Nothing you entered has been saved.",
  },

  intro: {
    heading: "About this study",
    body:
      "You will try a simulated age-verification process for a fictional online platform and answer questions about your experience. No camera, facial images, or government ID will be collected. When making choices, imagine how you would respond if the platform and its requests were real.",
    continueLabel: "Continue",
  },

  consent: {
    heading: "Study information and assent",
    researcherContact: "[RESEARCHER NAME, ROLE, AND CONTACT INFORMATION]",
    supervisorContact: "[SUPERVISOR OR TEACHER NAME AND CONTACT INFORMATION]",
    participationRequirements: "[APPROVED PARTICIPATION REQUIREMENTS]",
    dataCollected:
      "The research app records: a random response code, the study version, which of two information screens you were shown, your choices in the simulated process (start or decline, continue or stop), your questionnaire answers, and the time between steps. The app itself does not record your name, email address, birth date, home address, student ID, or any images. [HOSTING NOTE: STATE WHETHER THE HOSTING SERVICE LOGS IP ADDRESSES OR OTHER CONNECTION DETAILS]",
    storageAndAccess: "[DATA STORAGE, ACCESS, AND RETENTION ARRANGEMENTS]",
    withdrawal: "[WITHDRAWAL PROCEDURE, INCLUDING HOW TO USE THE RESPONSE CODE]",
    duration: "[EXPECTED DURATION]",
    parentalPermissionNote:
      "If you are under 18, parental permission is handled through the approved recruitment process outside this app. Nothing you check on this screen replaces that permission.",
    assentStatement: "I have read this information and agree to take part.",
    agreeLabel: "Continue",
    declineLabel: "I do not want to take part",
    declinedMessage:
      "Thank you for considering the study. You have not taken part, and nothing has been saved. You can close this window.",
  },

  scenario: {
    heading: "A fictional platform",
    body:
      "Imagine you want to join a group voice chat on ConnectSpace. This feature is available to users aged 16 and older. Before entering, the platform asks you to complete an age check.",
    continueLabel: "Continue",
  },

  verification: {
    heading: "Confirm your age group",
    body: "ConnectSpace uses a facial age check to assess whether you meet the age requirement for this feature.",
    // Shown only in the advance-notice condition. The later-notice condition
    // reserves the same space so the layout is identical.
    advanceNoticeSentence:
      "If the facial check cannot confidently confirm your age, you may be asked to provide a government-issued ID.",
    startLabel: "Start simulated check",
    declineLabel: "Decline verification",
    declinedMessage: "Your choice has been recorded.",
  },

  simulation: {
    label: "Simulated check",
    durationMs: 3000,
    status: "Checking",
  },

  result: {
    line1: "We could not confidently confirm that you meet the age requirement.",
    line2: "To continue to this feature, ConnectSpace would request a government-issued ID.",
    line3: "This is a simulation. Do not provide a real ID.",
    continueLabel: "I would continue with ID verification",
    stopLabel: "I would stop here",
    continueConfirmation: "Your choice has been recorded. No ID is needed for this study.",
    stopConfirmation: "Your choice has been recorded.",
    nextLabel: "Continue to the questions",
  },

  questionnaire: {
    heading: "Your experience",
    instruction: "Answer based on how you would feel if this were a real platform. You may skip any question.",
    scale: [
      { value: 1, label: "Strongly disagree" },
      { value: 2, label: "Disagree" },
      { value: 3, label: "Neither agree nor disagree" },
      { value: 4, label: "Agree" },
      { value: 5, label: "Strongly agree" },
    ],
    // Agreement items. "measure" is a label for the researcher only; the
    // measures are stored separately and never combined automatically.
    items: [
      {
        id: "risk_exposure",
        measure: "perceived_privacy_risk",
        text: "I would be concerned that information requested during this process could be exposed in a security incident.",
      },
      {
        id: "risk_misuse",
        measure: "perceived_privacy_risk",
        text: "I would be concerned that information requested during this process could be used for purposes I did not expect.",
      },
      {
        id: "risk_feel",
        measure: "perceived_privacy_risk",
        text: "Providing the information requested during this process would feel risky to me.",
      },
      {
        id: "transp_explained",
        measure: "perceived_transparency",
        text: "The platform clearly explained what the verification process could involve.",
      },
      {
        id: "transp_expect",
        measure: "perceived_transparency",
        text: "I knew what to expect from the process before deciding whether to start.",
      },
      {
        id: "id_unexpected",
        measure: "unexpectedness",
        onlyIfReachedIdPrompt: true,
        text: "The government-ID request was unexpected.",
      },
      {
        id: "id_understood",
        measure: "unexpectedness",
        onlyIfReachedIdPrompt: true,
        text: "Before starting the facial check, I understood that a government ID might be requested.",
      },
    ],
    recall: {
      id: "recall_notice",
      text: "Before the simulated facial check began, did the screen mention that a government ID might be requested?",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
        { value: "not_sure", label: "Not sure" },
        { value: "did_not_start", label: "I did not start the check" },
      ],
    },
    priorExperience: {
      id: "prior_experience",
      text: "Have you previously encountered an online age-verification process?",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
        { value: "not_sure", label: "Not sure" },
        { value: "prefer_not", label: "Prefer not to answer" },
      ],
    },
    idAvailability: {
      id: "id_availability",
      text: "Would you have access to an acceptable government-issued ID if a real platform requested one?",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
        { value: "not_sure", label: "Not sure" },
        { value: "prefer_not", label: "Prefer not to answer" },
      ],
    },
    breachAwareness: {
      id: "breach_awareness",
      text: "Before this study, had you heard about a security incident involving identity documents submitted for online age-related checks?",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
        { value: "not_sure", label: "Not sure" },
        { value: "prefer_not", label: "Prefer not to answer" },
      ],
    },
    openEnded: {
      id: "open_influence",
      text: "What most influenced your decision to continue or stop?",
      maxLength: 1000,
    },
    stopReasons: {
      id: "stop_reasons",
      text: "You declined or stopped. What were your reasons? Select all that apply.",
      options: [
        { value: "privacy_security", label: "Privacy or security concerns" },
        { value: "no_id_available", label: "I would not have an acceptable ID available" },
        { value: "too_much_effort", label: "The process required too much effort" },
        { value: "unexpected_request", label: "The additional request was unexpected" },
        { value: "feature_not_important", label: "The feature was not important enough to me" },
        { value: "other", label: "Another reason" },
        { value: "prefer_not", label: "Prefer not to answer" },
      ],
    },
    submitLabel: "Submit answers",
  },

  // Disabled by default. Enable only if approved and justified by the
  // research plan. Comparisons on these items in a scripted simulation are
  // not evidence of algorithmic bias.
  demographics: {
    enabled: false,
    items: [
      {
        id: "demo_gender",
        text: "How do you describe your gender? (optional)",
        options: [
          { value: "woman", label: "Woman or girl" },
          { value: "man", label: "Man or boy" },
          { value: "nonbinary", label: "Non-binary" },
          { value: "self_describe", label: "I describe myself another way" },
          { value: "prefer_not", label: "Prefer not to answer" },
        ],
      },
      {
        id: "demo_race",
        text: "How do you describe your race or ethnicity? (optional)",
        options: [
          { value: "asian", label: "Asian" },
          { value: "black", label: "Black or African American" },
          { value: "hispanic", label: "Hispanic or Latino" },
          { value: "middle_eastern", label: "Middle Eastern or North African" },
          { value: "native", label: "American Indian or Alaska Native" },
          { value: "pacific", label: "Native Hawaiian or Pacific Islander" },
          { value: "white", label: "White" },
          { value: "multiple", label: "Two or more" },
          { value: "self_describe", label: "I describe myself another way" },
          { value: "prefer_not", label: "Prefer not to answer" },
        ],
      },
    ],
  },

  debrief: {
    heading: "About this study",
    body:
      "This study examines whether receiving advance notice of a possible government-ID requirement affects responses to a simulated age-verification process. The facial check and its result were scripted. No camera, facial images, or government IDs were collected.",
    scope:
      "The study measures choices made within a disclosed simulation. It does not measure whether anyone would upload a real ID.",
    responseCodeIntro:
      "Your response code is below. Keep it if you might want your answers removed later. You can request deletion with this code alone; no name is needed.",
    finishLabel: "Finish",
    finishedMessage: "Thank you. You may close this window.",
  },

  withdrawal: {
    linkLabel: "Withdraw from study",
    heading: "Withdraw from the study?",
    body:
      "Withdrawing ends your participation now. It is different from declining the fictional platform's verification. Your answers so far will be handled as described in the study information.",
    confirmLabel: "Yes, withdraw",
    cancelLabel: "No, go back",
    // false: only the fact of withdrawal, the condition, and the step reached
    // are kept. true: partial responses are kept with status "withdrawn".
    retainPartialResponses: false,
    withdrawnMessage:
      "You have withdrawn from the study. Thank you for your time. You may close this window.",
  },

  // Storage is set by the researcher before activation.
  //   none:            preview only; nothing is stored as research data
  //   local-device:    records stay in this browser's storage on this device
  //   remote-endpoint: records are sent to the reference server (server/)
  storage: {
    adapter: "none",
    endpointUrl: "",
    submitToken: "",
  },

  // Preview-only helpers. Ignored in research mode.
  preview: {
    allowForcedCondition: true,
  },
};

export const PLACEHOLDER_PATTERN = /\[[A-Z][A-Z0-9 ,.:;'()/-]*\]/g;

/** Return every placeholder still present in researcher-editable text. */
export function findPlaceholders(config) {
  const found = [];
  const c = config.consent || {};
  for (const key of Object.keys(c)) {
    const value = c[key];
    if (typeof value !== "string") continue;
    const matches = value.match(PLACEHOLDER_PATTERN);
    if (matches) found.push({ field: `consent.${key}`, placeholders: matches });
  }
  return found;
}

/** Age categories derived from the approved range. */
export function ageCategories(config) {
  const { minAge, maxAge } = config.eligibility;
  const cats = [];
  cats.push({ value: `under_${minAge}`, label: `${minAge - 1} or younger`, eligible: false });
  for (let age = minAge; age <= maxAge; age += 1) {
    cats.push({ value: `age_${age}`, label: String(age), eligible: true });
  }
  cats.push({ value: `over_${maxAge}`, label: `${maxAge + 1} or older`, eligible: false });
  return cats;
}

/** Deep clone (structuredClone exists in browsers and Node 17+). */
export function cloneConfig(config) {
  return structuredClone(config);
}

/** Merge a stored (possibly partial) config over the defaults. */
export function mergeConfig(stored) {
  const base = cloneConfig(DEFAULT_STUDY_CONFIG);
  if (!stored || typeof stored !== "object") return base;
  return deepMerge(base, stored);
}

function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    const s = source[key];
    const t = target[key];
    if (Array.isArray(s)) {
      target[key] = structuredClone(s);
    } else if (s && typeof s === "object" && t && typeof t === "object" && !Array.isArray(t)) {
      deepMerge(t, s);
    } else {
      target[key] = s;
    }
  }
  return target;
}

/**
 * Checks that must pass before research mode may be activated. Returns a
 * list of problems; an empty list means activation is allowed.
 */
export function activationProblems(config) {
  const problems = [];
  for (const p of findPlaceholders(config)) {
    problems.push(`Placeholder text remains in ${p.field}: ${p.placeholders.join(", ")}`);
  }
  const e = config.eligibility || {};
  if (
    !Number.isInteger(e.minAge) ||
    !Number.isInteger(e.maxAge) ||
    e.minAge > e.maxAge ||
    e.minAge < 13 ||
    e.maxAge > 25
  ) {
    problems.push(
      "Approved age range must be whole numbers between 13 and 25 with the minimum no greater than the maximum."
    );
  }
  if (!e.recruitmentCriteriaText || !e.recruitmentCriteriaText.trim()) {
    problems.push("Recruitment criteria text is empty.");
  }
  const s = config.storage || {};
  if (s.adapter === "none" || !s.adapter) {
    problems.push("A storage configuration is required (local-device or remote-endpoint).");
  } else if (s.adapter === "remote-endpoint") {
    if (!/^https?:\/\//.test(s.endpointUrl || "")) {
      problems.push("Remote endpoint URL must start with http:// or https://.");
    }
    if (!s.submitToken || s.submitToken.length < 16) {
      problems.push("Remote endpoint submit token must be at least 16 characters.");
    }
  } else if (s.adapter !== "local-device") {
    problems.push(`Unknown storage adapter: ${s.adapter}`);
  }
  if (!config.studyVersion || /draft/i.test(config.studyVersion)) {
    problems.push('Study version must be set to a non-draft value (for example "1.0.0").');
  }
  if (!config.withdrawal || typeof config.withdrawal.retainPartialResponses !== "boolean") {
    problems.push("Withdrawal policy (retain partial responses: yes or no) must be set.");
  }
  return problems;
}
