# Local pilot trial

Use this walkthrough with the clean synthetic account provisioned for the local pilot. It uses sample values only; do not enter personal financial details or real statement files. The app records planning information but does not connect to a bank, pay a bill, or move money.

## Trial setup

Run `npm run pilot:trial` with the local services running. It creates or reuses a genuine local identity without seeding financial records. Open the private `.pilot-trial/START-HERE.md` for sign-in details, then visit `http://127.0.0.1:3001/auth/signin`. The sample statement is `.pilot-trial/statement.csv`. Neither file should be shared or committed.

1. Sign in to the invited local account and open **Settings**. Create or use one INR savings/current account named `Trial account`. Set its balance to ₹10,000, then use **Confirm balance**. This is the current balance snapshot for the exercise.
2. In **Activity**, import the sample CSV from the local trial fixture into `Trial account`. Enter its statement opening balance of ₹10,500 and closing balance of ₹10,000. Review the server preview: it should contain two expense rows, ₹300 and ₹200, whose total reconciles the statement. Commit those rows once.
3. Check Activity. The two imported expenses should each appear once and be assigned to `Trial account`. The ₹10,000 confirmed balance is the current snapshot; do not subtract those same historical statement rows again or re-enter them manually.
4. In **Goals**, create a goal such as `Rainy day`. In **Obligations**, add one active expense bill for ₹1,000, due tomorrow, and assign it to `Trial account`.
5. Open **Cashflow** to configure the plan: next payday seven days from today, ₹300 daily allowance, ₹2,000 minimum reserve, the `Rainy day` goal, and ₹500 reserved for that goal. Include `Trial account` in the plan and save. Open **Today** to review the resulting position and assumptions.

## What to check

Treat the plan as an estimate from the entered snapshot and commitments. Check the relationships rather than relying on one displayed total: the bill should affect the forecast once; the imported ₹300 and ₹200 should remain historical Activity entries without being deducted again from the confirmed ₹10,000 current balance; and reserving ₹500 for the goal should reduce the available projection without creating an expense or transfer. Confirm the bill and account are attached to the same account, the balance confirmation is current, and there are no unassigned transactions or warnings before interpreting the forecast.

Try the extra-expense scenario on Cashflow, then clear it. It should change the preview only; Activity and the saved plan should remain unchanged. If you test **Mark paid**, choose **Link an existing payment** only for a posted expense with the exact amount and paying account. Choose **Record a new payment** only after checking Activity and confirming that payment is absent. Both choices record the occurrence; neither sends money.

Record any mismatch between expected and observed behavior, including the route, inputs, visible result, and whether you needed help. Do not silently correct the fixture to make a result look right. For a fresh trial, delete this synthetic account through Settings and rerun `npm run pilot:trial`; the setup command never clears existing records by itself.

## Usability and trust scorecard for later invited users

Use this blank scorecard in moderated sessions with three to five later invitees. These are questions to ask, not results or claims. Keep each session separate, use the synthetic scenario where practical, and ask before recording a quote. Remove names and account details from notes.

| Participant code | Task completed without help? | Where they paused or asked for help | Trust rating (1–5) | Usability rating (1–5) |
|---|---|---|---:|---:|
| P1 |  |  |  |  |
| P2 |  |  |  |  |
| P3 |  |  |  |  |
| P4 (optional) |  |  |  |  |
| P5 (optional) |  |  |  |  |

After each task, ask:

- “What do you think this forecast includes, and what could it be missing?”
- “Was it clear whether the statement rows were already in Activity and whether the current balance was a separate snapshot?”
- “When marking a bill paid, could you tell whether the app would link an existing expense, add a new record, or move money?”
- “How confident do you feel checking or correcting these inputs yourself?”

Use the same scale for both ratings: 1 means very difficult / not confident; 5 means very easy / very confident. Record the participant’s own explanation beside the number. A three-to-five-person session is a small qualitative usability check, not evidence of population outcomes, financial accuracy, or regulatory readiness. Report only observations actually collected and include the sample size and limitations.
