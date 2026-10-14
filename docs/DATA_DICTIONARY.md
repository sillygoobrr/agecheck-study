# Data dictionary

Generated from `src/data-dictionary.js`, which the participant app, the reference server, and the researcher dashboard all import. Regenerate with `node tools/dictionary-to-markdown.js` after changing that file.

One record per participant who gave assent. Nothing is stored for visitors who were ineligible or did not agree to take part.

## Special codes

| Code | Meaning |
|---|---|
| `not_reached` | The participant never saw this step or item. |
| `skipped` | The item was shown and left unanswered. |
| `missing` | The questionnaire was never submitted. |
| `not_applicable` | The item does not apply to this pathway. |
| `disabled` | The item is turned off in the study configuration. |
| `not_collected` | The field is turned off in the study configuration. |
| `withheld` | Collected, then removed under the withdrawal policy. |

A participant who never reached the ID prompt has `id_decision = not_reached`. They are never coded as having declined ID verification.

## Conditions

- `advance_notice`: Advance notice
- `later_notice`: Later notice

## Final pathways

- `declined_before_check`: Declined before simulated check
- `stopped_at_id_request`: Started check and stopped at ID request
- `would_continue_with_id`: Started check and would continue with ID
- `incomplete_session`: Incomplete session
- `withdrawn`: Withdrawn from study

`withdrawn` takes precedence over every other pathway. `incomplete_session` covers a session that ended before an initial decision, or after starting the check but before an ID decision. The questionnaire's own state is in `questionnaire_status`, separate from the pathway.

## Fields (export order)

| Field | Type | Allowed values | Special codes | Measure | Meaning |
|---|---|---|---|---|---|
| `response_id` | string |  |  |  | Random identifier (UUID v4) generated when the participant gave assent. Not derived from any personal information. |
| `response_code` | string |  |  |  | Short code shown at the debrief, derived from response_id. A participant can request deletion with this code alone. |
| `record_kind` | enum | `research`, `preview_walkthrough`, `synthetic_demo` |  |  | research = real participant record in research mode. preview_walkthrough = a run of the app in preview mode. synthetic_demo = generated demo data. Demo and research records are stored separately and never mixed. |
| `study_version` | string |  |  |  | Version of the study configuration the participant saw. Frozen when research mode is activated. |
| `condition` | enum | `advance_notice`, `later_notice` |  |  | Assigned notice condition. advance_notice = the possible ID requirement was disclosed before the simulated check. later_notice = it was disclosed only after the uncertain result. |
| `assignment_method` | enum | `random`, `forced_preview` |  |  | random = assigned by the app's random draw (about 1:1). forced_preview = set with a URL parameter, which only works in preview mode. |
| `assigned_screen_displayed` | enum | `yes`, `no` |  |  | Whether the verification screen for the assigned condition was rendered to the participant. |
| `initial_decision` | enum | `start`, `decline` | `not_reached`, `withheld` |  | Choice on the verification screen. start = Start simulated check. decline = Decline verification. not_reached = the participant never reached that screen. |
| `reached_uncertain_result` | enum | `yes`, `no` |  |  | Whether the scripted uncertain-result screen was shown. |
| `reached_id_prompt` | enum | `yes`, `no` |  |  | Whether the government-ID prompt was shown. Identical to reached_uncertain_result in this design because both appear on the same screen; kept separate for clarity. |
| `id_decision` | enum | `continue`, `stop` | `not_reached`, `withheld` |  | Choice at the ID prompt. continue = I would continue with ID verification. stop = I would stop here. not_reached = never saw the prompt. Never code a participant who did not reach the prompt as having declined ID verification. |
| `final_pathway` | enum | `declined_before_check`, `stopped_at_id_request`, `would_continue_with_id`, `incomplete_session`, `withdrawn` |  |  | Summary of the verification choices. withdrawn takes precedence over everything else. incomplete_session = the session ended before an initial decision, or after starting the check but before an ID decision. |
| `withdrawn_at_step` | enum | `intro`, `eligibility`, `consent`, `scenario`, `verification`, `simulation`, `result`, `confirmation`, `questionnaire`, `debrief`, `finished` | `not_applicable` |  | The step the participant was on when they chose Withdraw from study. not_applicable if they did not withdraw. |
| `submission_status` | enum | `in_progress`, `submitted`, `withdrawn` |  |  | in_progress = record created at assent and not yet submitted. submitted = questionnaire submitted. withdrawn = participant withdrew. |
| `questionnaire_status` | enum | `submitted`, `missing` |  |  | submitted = the questionnaire was submitted (individual items may still be skipped). missing = never submitted. |
| `q_risk_exposure` | enum | `1`, `2`, `3`, `4`, `5` | `skipped`, `missing`, `withheld` | perceived_privacy_risk | Agreement (1 strongly disagree to 5 strongly agree): I would be concerned that information requested during this process could be exposed in a security incident. |
| `q_risk_misuse` | enum | `1`, `2`, `3`, `4`, `5` | `skipped`, `missing`, `withheld` | perceived_privacy_risk | Agreement: I would be concerned that information requested during this process could be used for purposes I did not expect. |
| `q_risk_feel` | enum | `1`, `2`, `3`, `4`, `5` | `skipped`, `missing`, `withheld` | perceived_privacy_risk | Agreement: Providing the information requested during this process would feel risky to me. |
| `q_transp_explained` | enum | `1`, `2`, `3`, `4`, `5` | `skipped`, `missing`, `withheld` | perceived_transparency | Agreement: The platform clearly explained what the verification process could involve. |
| `q_transp_expect` | enum | `1`, `2`, `3`, `4`, `5` | `skipped`, `missing`, `withheld` | perceived_transparency | Agreement: I knew what to expect from the process before deciding whether to start. |
| `q_id_unexpected` | enum | `1`, `2`, `3`, `4`, `5` | `skipped`, `missing`, `not_reached`, `withheld` | unexpectedness | Agreement: The government-ID request was unexpected. Asked only of participants who reached the ID prompt; not_reached otherwise. |
| `q_id_understood` | enum | `1`, `2`, `3`, `4`, `5` | `skipped`, `missing`, `not_reached`, `withheld` | unexpectedness | Agreement: Before starting the facial check, I understood that a government ID might be requested. Asked only of participants who reached the ID prompt. |
| `q_recall_notice` | enum | `yes`, `no`, `not_sure`, `did_not_start` | `skipped`, `missing`, `withheld` | notice_recall | Before the simulated facial check began, did the screen mention that a government ID might be requested? |
| `q_prior_experience` | enum | `yes`, `no`, `not_sure`, `prefer_not` | `skipped`, `missing`, `withheld` |  | Have you previously encountered an online age-verification process? |
| `q_id_availability` | enum | `yes`, `no`, `not_sure`, `prefer_not` | `skipped`, `missing`, `withheld` |  | Would you have access to an acceptable government-issued ID if a real platform requested one? The document type is never asked. |
| `q_breach_awareness` | enum | `yes`, `no`, `not_sure`, `prefer_not` | `skipped`, `missing`, `withheld` |  | Before this study, had you heard about a security incident involving identity documents submitted for online age-related checks? |
| `q_open_influence` | text (max 1000) |  | `skipped`, `missing`, `withheld` |  | Free text: What most influenced your decision to continue or stop? Review for accidental personal details before sharing exports. |
| `q_stop_reasons` | multi | `privacy_security`, `no_id_available`, `too_much_effort`, `unexpected_request`, `feature_not_important`, `other`, `prefer_not` | `skipped`, `missing`, `not_applicable`, `withheld` |  | Reasons selected by participants who declined or stopped, separated by semicolons. not_applicable for participants who would continue or who made no decision. |
| `q_demo_gender` | enum | `woman`, `man`, `nonbinary`, `self_describe`, `prefer_not` | `skipped`, `missing`, `disabled`, `withheld` |  | Optional gender item. disabled unless demographics are enabled in the approved configuration. |
| `q_demo_race` | enum | `asian`, `black`, `hispanic`, `middle_eastern`, `native`, `pacific`, `white`, `multiple`, `self_describe`, `prefer_not` | `skipped`, `missing`, `disabled`, `withheld` |  | Optional race or ethnicity item. disabled unless demographics are enabled in the approved configuration. |
| `ms_consent_to_assent` | integer |  | `not_reached`, `withheld` |  | Milliseconds from the study-information screen appearing to the participant giving assent. |
| `ms_verification_to_initial_decision` | integer |  | `not_reached`, `withheld` |  | Milliseconds from the verification screen appearing to the start or decline choice. This is a decision time, not a completion time. |
| `ms_simulation_duration` | integer |  | `not_reached`, `withheld` |  | Milliseconds the simulated check was displayed. Scripted to about 3000 for everyone; recorded so the fixed timing can be verified. |
| `ms_result_to_id_decision` | integer |  | `not_reached`, `withheld` |  | Milliseconds from the uncertain-result and ID-prompt screen appearing to the continue or stop choice. A decision time, not a completion time. |
| `ms_questionnaire_duration` | integer |  | `not_reached`, `withheld` |  | Milliseconds from the questionnaire appearing to submission. |
| `recruitment_code` | string (max 16) |  | `not_collected`, `skipped`, `withheld` |  | Recruitment code, only if enabled and approved. Must not contain names or student IDs. not_collected when the field is off. |

## Measures

Perceived privacy risk (`q_risk_*`), perceived transparency (`q_transp_*`), unexpectedness (`q_id_*`), and notice recall (`q_recall_notice`) are stored item by item. The app computes no composite score, no reliability statistic, and no significance test. The questionnaire items are custom draft items written for this study, not a validated scale.

## Timing

Every `ms_*` field is a difference between two moments inside the session, in milliseconds. No absolute timestamp is stored in a record. `ms_verification_to_initial_decision` and `ms_result_to_id_decision` are decision times for whichever choice was made; they are not completion times.
