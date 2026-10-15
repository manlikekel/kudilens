# Ideas to make KudiLens friendlier and more all-in-one

Grouped by impact. Pick any. The items already on your roadmap are marked (roadmap).

## A. Easier day to day
1. **Quick add button**: one tap from any page to log spending, income or a debt payment. Takes amount, category and note, and fills in today's date.
2. **Home "Today" card**: safe to spend, next bill due, and one suggestion. All on one screen.
3. **Bill and payday reminders (roadmap #9)**: email or phone alerts before rent, school fees, loan payments and subscriptions.
4. **Plain-language search**: type "how much did I spend on fuel in May?" and get the answer.
5. **Guided setup checklist**: progress bar showing what's still missing (accounts, goals, family), with one-tap links.

## B. Everything in one place
6. **Budgets and envelopes (roadmap #2)**: monthly limits per category with progress bars.
7. **Net worth history (roadmap #4)**: a monthly snapshot chart showing whether you're moving forward.
8. **Bills and subscriptions hub**: every recurring payment on one page, with a "cancel this?" flag for unused ones.
9. **Documents vault**: store payslips, insurance papers, land documents and receipts next to the item they belong to.
10. **Nigerian tax and payslip helper (roadmap #7)**: PAYE, pension and NHF breakdown, and take-home pay checks.
11. **Investment desk (roadmap #8)**: holdings, returns and maturity dates for T-bills and fixed deposits in one list.
12. **Household sharing (roadmap #10)**: invite a spouse to see or edit shared money.

## C. Smarter guidance
13. **Financial health score (roadmap #3)**: one number with "do this to raise it" steps.
14. **Scenario sandbox (roadmap #5)**: "what if I buy a car / change jobs / have a baby" without changing your real data.
15. **Relocation planner (roadmap #6)**: cost to move abroad, plus how long it would take to save for it.
16. **Monthly money check-in**: a 2-minute guided routine (review spending, update balances, mark bills paid).

## D. Comfort and trust
17. **Demo mode (roadmap #12)**: explore with sample data before entering your own.
18. **Security and trust page (roadmap #11)**: app lock, privacy mode, export and delete your data.
19. **Dark mode, bigger text option, and offline use**.
20. **Polish pass (roadmap #13)**: simpler navigation on phones, empty-state help and fewer taps.

## Suggested order
Quick add and the Today card first, because they make daily use easier. Then budgets, reminders, net worth history and the health score. After that, the larger tools.

## Technical notes
- New maths (budgets, health score, tax) goes in src/lib/finance as pure functions with tests.
- Reminders use the email domain already set up (once DNS is verified) plus push notifications through the existing service worker.
- Documents vault uses Cloud storage with per-user access rules.
