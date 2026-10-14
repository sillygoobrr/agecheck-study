// End-to-end tests for AgeCheck Study (Playwright).
// Run with: npm run test:e2e
//
// Each test gets a fresh browser context, so localStorage and sessionStorage
// start empty. The participant app runs in preview mode here, so records
// land in the demo store as preview_walkthrough records.

import { test, expect } from "@playwright/test";
import { DEFAULT_STUDY_CONFIG, cloneConfig } from "../src/study-config.js";

const DEMO_KEY = "agecheck.demo.records.v1";
const RESEARCH_KEY = "agecheck.research.records.v1";
const CONFIG_KEY = "agecheck.config.v1";
const NOTICE = "If the facial check cannot confidently confirm your age, you may be asked to provide a government-issued ID.";

async function installSpies(page) {
  await page.addInitScript(() => {
    const calls = [];
    window.__mediaCalls = calls;
    const md = navigator.mediaDevices;
    if (md) {
      for (const fn of ["getUserMedia", "getDisplayMedia", "enumerateDevices"]) {
        md[fn] = () => {
          calls.push(fn);
          return Promise.reject(new Error("blocked by test"));
        };
      }
    }
    navigator.getUserMedia = () => calls.push("legacy getUserMedia");
    if (navigator.permissions && navigator.permissions.query) {
      const orig = navigator.permissions.query.bind(navigator.permissions);
      navigator.permissions.query = (d) => {
        calls.push(`permissions.query:${d && d.name}`);
        return orig(d);
      };
    }
  });
}

async function open(page, { condition = null, extra = "" } = {}) {
  await installSpies(page);
  const q = ["reset=1"];
  if (condition) q.push(`condition=${condition}`);
  await page.goto(`/index.html?${q.join("&")}${extra}`);
  await expect(page.getByRole("heading", { name: "About this study" })).toBeVisible();
}

async function toVerification(page) {
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Before you begin" })).toBeVisible();
  await page.getByRole("radio", { name: "16", exact: true }).check();
  await page.getByRole("checkbox", { name: /approved Prosper-area/ }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Study information and assent" })).toBeVisible();
  await page.getByRole("checkbox", { name: /agree to take part/ }).check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: "A fictional platform" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Confirm your age group" })).toBeVisible();
}

async function startCheckToResult(page) {
  await page.getByRole("button", { name: "Start simulated check" }).click();
  await expect(page.getByText("Simulated check", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: /could not confidently confirm/ })).toBeVisible({ timeout: 8000 });
  await expect(page.getByText("This is a simulation. Do not provide a real ID.")).toBeVisible();
}

async function fillAndSubmitQuestionnaire(page, { answerAll = true } = {}) {
  await expect(page.getByRole("heading", { name: "Your experience" })).toBeVisible();
  if (answerAll) {
    const items = page.locator("fieldset.likert");
    const n = await items.count();
    for (let i = 0; i < n; i += 1) await items.nth(i).getByRole("radio").nth(3).check();
    for (const id of ["recall_notice", "prior_experience", "id_availability", "breach_awareness"]) {
      await page.locator(`fieldset[data-item="${id}"] input`).first().check();
    }
    await page.locator("#open_influence").fill("Test run. No personal details.");
    const reasons = page.locator('fieldset[data-item="stop_reasons"] input');
    if (await reasons.count()) await reasons.first().check();
  }
  await page.getByRole("button", { name: "Submit answers" }).click();
  await expect(page.getByRole("heading", { name: "About this study" })).toBeVisible();
  await expect(page.locator("#response-code")).toHaveText(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
}

async function records(page, key = DEMO_KEY) {
  return page.evaluate((k) => Object.values(JSON.parse(localStorage.getItem(k) || "{}")), key);
}

async function assertNoDeviceAccess(page) {
  expect(await page.evaluate(() => window.__mediaCalls)).toEqual([]);
  expect(await page.locator('input[type="file"]').count()).toBe(0);
  expect(await page.locator("video, canvas").count()).toBe(0);
}

// ---------------------------------------------------------------------------

test.describe("the six pathways", () => {
  for (const condition of ["advance", "later"]) {
    const cond = condition === "advance" ? "advance_notice" : "later_notice";

    test(`${condition} notice: decline initial check -> questionnaire -> debrief`, async ({ page }) => {
      await open(page, { condition });
      await toVerification(page);
      const notice = page.getByText(NOTICE);
      if (condition === "advance") await expect(notice).toBeVisible();
      else await expect(notice).toHaveCount(0);
      await assertNoDeviceAccess(page);
      await page.getByRole("button", { name: "Decline verification" }).click();
      await expect(page.getByRole("heading", { name: "Your choice has been recorded." })).toBeVisible();
      await page.getByRole("button", { name: "Continue to the questions" }).click();
      // The ID-specific items are not shown to someone who never reached the prompt.
      await expect(page.locator('fieldset[data-item="id_unexpected"]')).toHaveCount(0);
      await expect(page.locator('fieldset[data-item="stop_reasons"]')).toHaveCount(1);
      await fillAndSubmitQuestionnaire(page);
      const [r] = await records(page);
      expect(r.record_kind).toBe("preview_walkthrough");
      expect(r.condition).toBe(cond);
      expect(r.assignment_method).toBe("forced_preview");
      expect(r.assigned_screen_displayed).toBe("yes");
      expect(r.initial_decision).toBe("decline");
      expect(r.reached_id_prompt).toBe("no");
      expect(r.id_decision).toBe("not_reached");
      expect(r.final_pathway).toBe("declined_before_check");
      expect(r.q_id_unexpected).toBe("not_reached");
      expect(r.questionnaire_status).toBe("submitted");
      expect(r.submission_status).toBe("submitted");
      await assertNoDeviceAccess(page);
    });

    test(`${condition} notice: start -> stop at ID prompt -> questionnaire -> debrief`, async ({ page }) => {
      await open(page, { condition });
      await toVerification(page);
      await startCheckToResult(page);
      await assertNoDeviceAccess(page);
      // Both choices are rendered with the same style and size.
      const a = await page.getByRole("button", { name: "I would continue with ID verification" }).boundingBox();
      const b = await page.getByRole("button", { name: "I would stop here" }).boundingBox();
      expect(Math.abs(a.width - b.width)).toBeLessThan(2);
      expect(Math.abs(a.height - b.height)).toBeLessThan(2);
      expect(await page.locator('input[type="radio"]:checked').count()).toBe(0);
      await page.getByRole("button", { name: "I would stop here" }).click();
      await expect(page.getByRole("heading", { name: "Your choice has been recorded." })).toBeVisible();
      await page.getByRole("button", { name: "Continue to the questions" }).click();
      await expect(page.locator('fieldset[data-item="id_unexpected"]')).toHaveCount(1);
      await fillAndSubmitQuestionnaire(page);
      const [r] = await records(page);
      expect(r.condition).toBe(cond);
      expect(r.initial_decision).toBe("start");
      expect(r.reached_uncertain_result).toBe("yes");
      expect(r.id_decision).toBe("stop");
      expect(r.final_pathway).toBe("stopped_at_id_request");
      expect(r.q_id_unexpected).toBe("4");
      expect(r.ms_simulation_duration).toBeGreaterThanOrEqual(2900);
      expect(r.ms_simulation_duration).toBeLessThan(4500);
      expect(r.q_stop_reasons).toBe("privacy_security");
    });

    test(`${condition} notice: start -> continue with simulated ID -> questionnaire -> debrief`, async ({ page }) => {
      await open(page, { condition });
      await toVerification(page);
      await startCheckToResult(page);
      await page.getByRole("button", { name: "I would continue with ID verification" }).click();
      await expect(page.getByRole("heading", { name: "Your choice has been recorded. No ID is needed for this study." })).toBeVisible();
      // No fields of any kind on the confirmation screen.
      expect(await page.locator("input, textarea, select").count()).toBe(0);
      await page.getByRole("button", { name: "Continue to the questions" }).click();
      await expect(page.locator('fieldset[data-item="stop_reasons"]')).toHaveCount(0);
      await fillAndSubmitQuestionnaire(page);
      const [r] = await records(page);
      expect(r.condition).toBe(cond);
      expect(r.id_decision).toBe("continue");
      expect(r.final_pathway).toBe("would_continue_with_id");
      expect(r.q_stop_reasons).toBe("not_applicable");
      await assertNoDeviceAccess(page);
    });
  }
});

test("the verification card has identical layout in both conditions", async ({ browser }) => {
  const boxes = {};
  for (const condition of ["advance", "later"]) {
    const context = await browser.newContext({ viewport: { width: 1000, height: 900 } });
    const page = await context.newPage();
    await open(page, { condition });
    await toVerification(page);
    boxes[condition] = {
      start: await page.getByRole("button", { name: "Start simulated check" }).boundingBox(),
      decline: await page.getByRole("button", { name: "Decline verification" }).boundingBox(),
      slot: await page.locator(".notice-slot").boundingBox(),
    };
    await context.close();
  }
  for (const k of ["start", "decline", "slot"]) {
    expect(boxes.advance[k].y).toBeCloseTo(boxes.later[k].y, 0);
    expect(boxes.advance[k].height).toBeCloseTo(boxes.later[k].height, 0);
    expect(boxes.advance[k].x).toBeCloseTo(boxes.later[k].x, 0);
  }
});

test("refresh and back navigation keep the same condition and step", async ({ page }) => {
  await open(page); // random assignment
  await toVerification(page);
  const before = await page.locator(".notice-slot").getAttribute("data-condition");
  expect(["advance_notice", "later_notice"]).toContain(before);
  for (let i = 0; i < 3; i += 1) {
    await page.reload();
    await expect(page.getByRole("heading", { name: "Confirm your age group" })).toBeVisible();
    expect(await page.locator(".notice-slot").getAttribute("data-condition")).toBe(before);
  }
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Confirm your age group" })).toBeVisible();
  expect(await page.locator(".notice-slot").getAttribute("data-condition")).toBe(before);
  // A reload during the simulation restarts the fixed animation and still ends at the result.
  await page.getByRole("button", { name: "Start simulated check" }).click();
  await page.waitForTimeout(800);
  await page.reload();
  await expect(page.getByText("Simulated check", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: /could not confidently confirm/ })).toBeVisible({ timeout: 8000 });
  await page.getByRole("button", { name: "I would stop here" }).click();
  await page.getByRole("button", { name: "Continue to the questions" }).click();
  await fillAndSubmitQuestionnaire(page, { answerAll: false });
  const [r] = await records(page);
  expect(r.condition).toBe(before);
  expect(r.assignment_method).toBe("random");
  expect(r.q_risk_exposure).toBe("skipped");
  // After submission, refreshing shows the debrief again with the same code.
  const code = await page.locator("#response-code").textContent();
  await page.reload();
  await expect(page.locator("#response-code")).toHaveText(code);
  expect((await records(page)).length).toBe(1);
});

test("duplicate clicks do not create duplicate submissions", async ({ page }) => {
  await open(page, { condition: "later" });
  await toVerification(page);
  await page.getByRole("button", { name: "Start simulated check" }).dblclick();
  await expect(page.getByRole("heading", { name: /could not confidently confirm/ })).toBeVisible({ timeout: 8000 });
  await page.getByRole("button", { name: "I would continue with ID verification" }).dblclick();
  await page.getByRole("button", { name: "Continue to the questions" }).dblclick();
  await expect(page.getByRole("heading", { name: "Your experience" })).toBeVisible();
  await page.locator("fieldset.likert").first().getByRole("radio").nth(0).check();
  const submit = page.getByRole("button", { name: "Submit answers" });
  await submit.dblclick();
  await expect(page.getByRole("heading", { name: "About this study" })).toBeVisible();
  const rs = await records(page);
  expect(rs.length).toBe(1);
  expect(rs[0].submission_status).toBe("submitted");
  expect(rs[0].q_risk_exposure).toBe("1");
});

test("withdrawing from the study is recorded as withdrawal, not as declining verification", async ({ page }) => {
  await open(page, { condition: "advance" });
  await toVerification(page);
  await page.getByRole("button", { name: "Withdraw from study" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "No, go back" }).click();
  await expect(page.getByRole("heading", { name: "Confirm your age group" })).toBeVisible();
  await page.getByRole("button", { name: "Withdraw from study" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Yes, withdraw" }).click();
  await expect(page.getByRole("heading", { name: "Withdrawn" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Withdraw from study" })).toHaveCount(0);
  const [r] = await records(page);
  expect(r.final_pathway).toBe("withdrawn");
  expect(r.withdrawn_at_step).toBe("verification");
  expect(r.submission_status).toBe("withdrawn");
  expect(r.initial_decision).not.toBe("decline");
  expect(r.initial_decision).toBe("withheld");
  expect(r.questionnaire_status).toBe("missing");
});

test("withdrawal is unavailable before assent and is not confused with not taking part", async ({ page }) => {
  await open(page);
  await expect(page.getByRole("button", { name: "Withdraw from study" })).toHaveCount(0);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: "18 or older" }).check();
  await page.getByRole("checkbox", { name: /approved Prosper-area/ }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText(/only open to participants who meet/)).toBeVisible();
  expect((await records(page)).length).toBe(0);
  await open(page);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: "17", exact: true }).check();
  await page.getByRole("checkbox", { name: /approved Prosper-area/ }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "I do not want to take part" }).click();
  await expect(page.getByText(/You have not taken part/)).toBeVisible();
  expect((await records(page)).length).toBe(0);
});

test("a failed submission shows a clear recovery message and a retry succeeds without duplicates", async ({ page }) => {
  await open(page, { condition: "later", extra: "&failSubmit=1" });
  await toVerification(page);
  await page.getByRole("button", { name: "Decline verification" }).click();
  await page.getByRole("button", { name: "Continue to the questions" }).click();
  await page.locator("fieldset.likert").nth(1).getByRole("radio").nth(4).check();
  await page.locator("#open_influence").fill("Kept across the retry.");
  await page.getByRole("button", { name: "Submit answers" }).click();
  const alert = page.getByRole("alert");
  await expect(alert).toContainText("Your answers were not submitted.");
  await expect(alert).toContainText("Simulated submission failure");
  await expect(page.locator("#open_influence")).toHaveValue("Kept across the retry.");
  await expect(page.locator("fieldset.likert").nth(1).getByRole("radio").nth(4)).toBeChecked();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("heading", { name: "About this study" })).toBeVisible();
  const rs = await records(page);
  expect(rs.length).toBe(1);
  expect(rs[0].submission_status).toBe("submitted");
  expect(rs[0].q_risk_misuse).toBe("5");
  expect(rs[0].q_open_influence).toBe("Kept across the retry.");
});

test("keyboard-only use through a full pathway", async ({ page }) => {
  await open(page, { condition: "advance" });
  const pressUntil = async (predicate, max = 40) => {
    for (let i = 0; i < max; i += 1) {
      const ok = await page.evaluate(predicate);
      if (ok) return;
      await page.keyboard.press("Tab");
    }
    throw new Error("Could not reach the element with Tab");
  };
  const focusText = (text) =>
    pressUntil(`(() => { const el = document.activeElement; return !!el && (el.textContent || "").trim().startsWith(${JSON.stringify(text)}); })()`);
  const focusInput = (name, value) =>
    pressUntil(
      `(() => { const el = document.activeElement; return !!el && el.name === ${JSON.stringify(name)} && (${JSON.stringify(value)} === null || el.value === ${JSON.stringify(value)}); })()`
    );

  await focusText("Continue");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Before you begin" })).toBeVisible();
  await focusInput("ageCategory", null);
  await page.keyboard.press("ArrowDown"); // 15 or younger -> 16
  await focusInput("meetsCriteria", "yes");
  await page.keyboard.press("Space");
  await focusText("Continue");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Study information and assent" })).toBeVisible();
  await focusInput("assent", "yes");
  await page.keyboard.press("Space");
  await focusText("Continue");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "A fictional platform" })).toBeVisible();
  await focusText("Continue");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Confirm your age group" })).toBeVisible();
  await focusText("Start simulated check");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: /could not confidently confirm/ })).toBeVisible({ timeout: 8000 });
  await focusText("I would stop here");
  await page.keyboard.press("Enter");
  await focusText("Continue to the questions");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Your experience" })).toBeVisible();
  await focusInput("risk_exposure", "1");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight"); // -> 3
  await focusText("Submit answers");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "About this study" })).toBeVisible();
  const [r] = await records(page);
  expect(r.final_pathway).toBe("stopped_at_id_request");
  expect(r.q_risk_exposure).toBe("3");
});

test.describe("small phone screen", () => {
  test.use({ viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true });

  test("no horizontal scrolling and both choices fully visible", async ({ page }) => {
    await open(page, { condition: "later" });
    const noOverflow = async () =>
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await noOverflow();
    await toVerification(page);
    await noOverflow();
    await expect(page.getByRole("button", { name: "Start simulated check" })).toBeInViewport();
    await expect(page.getByRole("button", { name: "Decline verification" })).toBeInViewport();
    await startCheckToResult(page);
    await noOverflow();
    await page.getByRole("button", { name: "I would stop here" }).scrollIntoViewIfNeeded();
    await expect(page.getByRole("button", { name: "I would stop here" })).toBeInViewport();
    await page.getByRole("button", { name: "I would stop here" }).click();
    await page.getByRole("button", { name: "Continue to the questions" }).click();
    await noOverflow();
    await fillAndSubmitQuestionnaire(page);
    await noOverflow();
  });
});

test("no camera, microphone, file inputs, or third-party requests anywhere", async ({ page, baseURL }) => {
  const requests = [];
  page.on("request", (req) => requests.push(req.url()));
  await open(page, { condition: "advance" });
  await toVerification(page);
  await assertNoDeviceAccess(page);
  await startCheckToResult(page);
  await assertNoDeviceAccess(page);
  await page.getByRole("button", { name: "I would continue with ID verification" }).click();
  await page.getByRole("button", { name: "Continue to the questions" }).click();
  await assertNoDeviceAccess(page);
  await fillAndSubmitQuestionnaire(page);
  await assertNoDeviceAccess(page);
  await page.goto("/researcher.html");
  await expect(page.getByRole("heading", { name: "Counts by condition and pathway" })).toBeVisible();
  await assertNoDeviceAccess(page);
  for (const url of requests) expect(url.startsWith(baseURL)).toBe(true);
  // The page source never references device APIs.
  for (const file of ["/src/app.js", "/src/researcher.js", "/src/storage.js", "/src/engine.js"]) {
    const src = await (await page.request.get(file)).text();
    expect(src).not.toMatch(/getUserMedia|mediaDevices|getDisplayMedia|type="file"|type=file/);
  }
});

test("researcher dashboard: demo data, counts, export, dictionary, deletion", async ({ page }) => {
  await page.goto("/researcher.html");
  await expect(page.getByText("Preview mode", { exact: false }).first()).toBeVisible();
  await page.getByRole("tab", { name: "Demo data" }).click();
  await page.locator("#demo-count").fill("30");
  await page.getByRole("button", { name: "Generate (replace demo set)" }).click();
  await expect(page.getByText("Generated 30 synthetic demo records.")).toBeVisible();
  const demo = await records(page);
  expect(demo.length).toBe(30);
  expect(demo.every((r) => r.record_kind === "synthetic_demo")).toBe(true);
  expect(await records(page, RESEARCH_KEY)).toEqual([]);

  await page.getByRole("tab", { name: "Overview" }).click();
  await expect(page.getByRole("heading", { name: "Counts by condition and pathway" })).toBeVisible();
  const totalCell = page.locator("table").first().locator("tbody tr").last().locator("th").last();
  await expect(totalCell).toHaveText("30");
  await expect(page.getByText("Research data (research mode not active)")).toBeDisabled();

  await page.getByRole("tab", { name: "Records" }).click();
  const code = (await page.locator("tbody tr").first().locator("td").first().textContent()).trim();
  expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);

  await page.getByRole("tab", { name: "Export" }).click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Download CSV/ }).click()]);
  expect(download.suggestedFilename()).toMatch(/^agecheck-demo-v.*\.csv$/);
  const [jsonDl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download JSON" }).click()]);
  expect(jsonDl.suggestedFilename()).toMatch(/^agecheck-demo-v.*\.json$/);

  await page.getByRole("tab", { name: "Data dictionary" }).click();
  await expect(page.getByRole("cell", { name: "final_pathway" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "q_recall_notice" })).toBeVisible();

  await page.getByRole("tab", { name: "Delete by code" }).click();
  await page.locator("#delete-code").fill(code);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText(`Deleted 1 record(s) with code ${code}.`)).toBeVisible();
  expect((await records(page)).length).toBe(29);
});

test.describe("research mode", () => {
  function researchConfig(adapter) {
    const c = cloneConfig(DEFAULT_STUDY_CONFIG);
    c.mode = "research";
    c.frozen = true;
    c.studyVersion = "1.0.0";
    c.storage = { adapter, endpointUrl: "", submitToken: "" };
    for (const k of Object.keys(c.consent)) {
      if (typeof c.consent[k] === "string") c.consent[k] = c.consent[k].replace(/\[[^\]]*\]/g, "Filled wording for tests.");
    }
    return c;
  }

  test("collection is disabled until storage is configured", async ({ page }) => {
    await page.goto("/index.html");
    await page.evaluate(([k, cfg]) => localStorage.setItem(k, JSON.stringify(cfg)), [CONFIG_KEY, researchConfig("none")]);
    await page.goto("/index.html?reset=1");
    await expect(page.getByRole("heading", { name: "Collection is not configured" })).toBeVisible();
  });

  test("local-device research records are separate from demo records and ignore forced conditions", async ({ page }) => {
    await installSpies(page);
    await page.goto("/index.html");
    await page.evaluate(([k, cfg]) => localStorage.setItem(k, JSON.stringify(cfg)), [CONFIG_KEY, researchConfig("local-device")]);
    await page.goto("/index.html?reset=1&condition=advance&failSubmit=1");
    await expect(page.getByText("Research mode", { exact: true })).toBeVisible();
    await expect(page.getByText("Preview mode", { exact: false })).toHaveCount(0);
    await toVerification(page);
    await page.getByRole("button", { name: "Decline verification" }).click();
    await page.getByRole("button", { name: "Continue to the questions" }).click();
    await fillAndSubmitQuestionnaire(page, { answerAll: false });
    const research = await records(page, RESEARCH_KEY);
    expect(research.length).toBe(1);
    expect(research[0].record_kind).toBe("research");
    expect(research[0].assignment_method).toBe("random");
    expect(research[0].study_version).toBe("1.0.0");
    expect(await records(page, DEMO_KEY)).toEqual([]);
    await page.goto("/researcher.html");
    await expect(page.getByText("Research mode", { exact: false }).first()).toBeVisible();
    await page.getByRole("button", { name: "Research data" }).click();
    await expect(page.getByText("1 research record(s) loaded.")).toBeVisible();
  });
});
