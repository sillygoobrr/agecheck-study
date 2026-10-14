# Before collection: what needs teacher or research approval

The app ships in preview mode and cannot collect research data until every item below is settled and the configuration is activated. Nothing here is approved by default. The app makes no claim of institutional approval anywhere.

## Wording the researcher must supply (placeholders in the dashboard)

- [ ] Researcher name, role, and contact information.
- [ ] Supervisor or teacher name and contact information.
- [ ] Approved participation requirements (who may take part, and how they were recruited).
- [ ] What the research app actually records, matching the data dictionary, including what the hosting service logs.
- [ ] Data storage, access, and retention arrangements (see `docs/STORAGE_AND_ACCESS.md`).
- [ ] Withdrawal procedure, including how a participant uses the response code to request deletion and by what date.
- [ ] Expected duration.

Research mode cannot be activated while any `[PLACEHOLDER]` remains in these fields.

## Decisions that need approval

- [ ] **Eligibility range.** Default 16 to 17. Any change is set in the dashboard before activation.
- [ ] **Recruitment criteria statement** shown as the checkbox on the eligibility screen (default refers to the approved Prosper-area recruitment process).
- [ ] **Parental permission process** for minors, handled entirely outside the app. The app states that checking a box is not a substitute.
- [ ] **Recruitment codes.** Off by default. If used, they must not contain names or student IDs, and permission records that use them must be kept separately from the experimental data.
- [ ] **Withdrawal policy.** Default: a participant who withdraws mid-session leaves only the fact of withdrawal, the condition, and the step reached; everything else is coded `withheld`. The alternative keeps partial responses marked `withdrawn`. Also decide whether withdrawn participants count in the denominator of the primary outcome.
- [ ] **Optional demographics.** Off by default. Enable only if justified by the research plan. Comparisons on these items within a scripted simulation say nothing about real algorithmic bias.
- [ ] **Storage configuration.** Local-device (in-person on a researcher-controlled device) or remote endpoint (the reference server). See the limitations document.
- [ ] **Hosting and logging.** Identify what the host logs (IP addresses, timestamps) and for how long. Adjust the study information accordingly.
- [ ] **Study version.** Set a non-draft version string. The configuration freezes on activation; a change after collection starts is a new version.
- [ ] **Questionnaire items.** The items are custom draft items written for this study, not validated scales. Approve the wording as is or revise it before activation.
- [ ] **Deletion handling.** Who receives deletion requests, how quickly they act, and how they confirm without collecting a name.
- [ ] **Data access.** Who holds the admin token or the exporting device, and where exports are kept.

## Things the app will not do, by design

- Access the camera or microphone, or ask for any permission.
- Collect or display real identification, names, email addresses, birth dates, addresses, or student IDs.
- Show an age estimate or a confidence score.
- Treat a checkbox as parental permission.
- Claim the study is approved, or that participants' ages were verified.
- Publish itself or start collection without the researcher activating the configuration.

## Final steps before the first participant

1. Fill every placeholder and save in the dashboard.
2. Run "Check activation requirements" until it reports that all requirements are met.
3. Activate research mode, then download `study.config.json` or push it to the server.
4. Deploy, open the participant link on a device that is not the researcher's, and confirm the header shows "Research mode" and the dashboard shows the test record under research data.
5. Delete the test record by its response code.
6. Confirm with the supervisor that the deployed wording matches the approved wording.
