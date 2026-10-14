# Experimental logic

Research question: how does the advance notice of a possible government-ID requirement affect perceived privacy risk and completion decisions among teenagers in Prosper, Texas, using a simulated facial age-verification process?

## The one manipulated variable

The only thing that differs between the two groups is **when** the participant learns that a government ID might be requested.

| | Advance notice (`advance_notice`) | Later notice (`later_notice`) |
|---|---|---|
| Verification screen | Shared heading and sentence, **plus** "If the facial check cannot confidently confirm your age, you may be asked to provide a government-issued ID." | Shared heading and sentence only. The space the extra sentence would occupy is reserved, so the buttons sit in the same place. |
| Everything else | Identical | Identical |

Both groups see the same study information, the same scenario, the same simulated check, the same uncertain result, the same ID prompt wording, the same questionnaire, and the same debrief. The later-notice group first learns about the ID request on the result screen; the advance-notice group reads it twice.

## Assignment

- Assignment happens at the moment of assent, after eligibility is confirmed, with a cryptographically random draw at about 1:1.
- The assigned condition and a random response ID are stored in the tab's session storage. A refresh, a reload during the simulation, or the Back button returns to the same step with the same condition. The Back button is intercepted after assent so it cannot leave the study by accident.
- In preview mode only, `?condition=advance` or `?condition=later` forces a condition for testing. The record then carries `assignment_method = forced_preview`. In research mode the parameter is ignored and every record carries `assignment_method = random`.

## What is held constant

- The simulated check always runs for the configured duration (3,000 ms by default) and always ends in the same scripted uncertain result. Nothing about the result is randomized.
- No age estimate, confidence percentage, or other number is ever shown.
- The feature's stated age requirement (16 and older) is the same in both conditions.
- The two decision buttons on each decision screen share one style, one size, and one grid. Neither is preselected. The ID-stage screen uses the exact wording specified in the research plan in both conditions.

## Participant flow

1. Introduction (no hypothesis, no mention of being misled).
2. Eligibility: age category from the approved range (single-year categories, no birth date) and the approved recruitment-criteria checkbox. Ineligible visitors exit; their answers are not stored.
3. Study information and assent. Identical for both conditions. Parental permission is explicitly handled outside the app. Declining leaves no record.
4. Scenario text for the fictional platform ConnectSpace.
5. Verification screen (the manipulation). "Start simulated check" or "Decline verification". A separate "Withdraw from study" control lives in the research app's header, outside the platform frame, on every study screen after assent.
6. Simulated check: abstract face outline, fixed progress bar, labelled "Simulated check". No camera, no permission prompt.
7. Uncertain result and ID request, same for everyone who started. "I would continue with ID verification" or "I would stop here". Continuing shows "Your choice has been recorded. No ID is needed for this study." Nothing is typed or uploaded.
8. Questionnaire for everyone still in the study, including those who declined or stopped. Every item can be skipped. The two ID-specific items appear only for participants who reached the ID prompt. The stop-reasons item appears only for participants who declined or stopped.
9. Debrief with the response code and the configured withdrawal procedure.

## Outcomes

- **Primary completion outcome:** reaching the ID prompt and choosing "I would continue with ID verification", counted among **all participants assigned to each condition**. The dashboard shows this with and without withdrawn participants in the denominator, because which one applies follows the approved withdrawal policy.
- **Initial-stage decision** (`initial_decision`) and **ID-stage decision** (`id_decision`) are stored separately and never merged. The dashboard also shows the ID-stage rate among those who reached the prompt, labelled as descriptive only: advance notice can change who starts the check, so that subgroup is no longer a fair comparison between conditions.
- **Perceived privacy risk** (three items), **perceived transparency** (two items), **unexpectedness** (two items, ID prompt only), and **notice recall** (one item) are stored item by item. The app computes no composite or "trust" score and no statistics beyond counts and proportions.
- **Timing** is stored as separate relative intervals. Time to a decline is labelled as a decision time, never as a completion time.

## What the study does and does not measure

It measures choices and self-reports inside a disclosed simulation. It does not measure whether anyone would upload a real ID, does not verify anyone's age, and does not evaluate facial-analysis accuracy or bias.
