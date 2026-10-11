# First-run checklist (real Google)

Everything in this project was tested against a careful imitation of Google Sheets, but only real Google can
confirm the items below. **Do this once on a spare Google account, or on a copy you can throw away, before the
family starts using it.** It takes about 20 minutes. Tick each box. If something does not match, write down what
you saw and tell whoever is helping you.

Follow `docs/SETUP.md` to install, then check:

## A. Setup

- [ ] **A1.** Running `setupAll` finishes ("Execution completed") with no red error. It may take a minute or two.
- [ ] **A2.** If it stops with an error or a time-out, running `setupAll` again finishes it. Nothing is doubled.
- [ ] **A3.** The spreadsheet has these tabs in this order: README first, then orange `cfg_` tabs, blue `lib_` tabs,
      green `act_` tabs. There is no tab called `Sheet1` and the grey `sys_lists` tab is hidden.
- [ ] **A4.** In `cfg_members` there is one row: you, with role `admin`.
- [ ] **A5.** `lib_ingredients` has about 187 rows. `cfg_settings` has 30 rows.

## B. Dropdowns

- [ ] **B1.** In `lib_dishes`, click a cell under **type**. A dropdown shows names (Beef, Chicken, Pasta...) in
      alphabetical order. Same for **cuisine** and **cook_method**.
- [ ] **B2.** Under **season** (tab `lib_dish_seasons`) the dropdown reads Fall, Spring, Summer, Winter.
- [ ] **B3.** In `lib_ingredients`, the **aisle** dropdown lists aisle names A to Z (Bakery, Baking, Beverages...).
- [ ] **B4.** Check boxes (for example **favorite** in `lib_dishes`) can be ticked.
- [ ] **B5.** Typing the same dish name twice in `lib_dishes` is refused ("Each name must be unique").
- [ ] **B6.** After adding a dish named "Zebra Stew" and one named "apple pie" in `lib_dishes`, the dish dropdown in
      `act_meal_plan` lists "apple pie" before "Zebra Stew". (The list can take a few seconds to refresh.)
- [ ] **B7.** The grey columns (`plan_id`, `queue_id`, `item_id`) and `healthy_score` show a warning when you try to
      type in them.

## C. The Meal Planner menu (in the spreadsheet)

- [ ] **C1.** After Part 3 of the setup guide, a **Meal Planner** menu appears with **Back up now** and **Check links**.
- [ ] **C2.** **Back up now** (as the owner) asks for permission once, then says it saved a backup. A folder "Meal
      Planner Backups" with the copy appears in Drive.
- [ ] **C3.** Running **Back up now** as another family member says only the owner can do it.
- [ ] **C4.** In `lib_dishes`, retype a dish name in the sheet. A message says it was renamed "in N places". In
      `act_meal_plan` the old name has changed too.
- [ ] **C5.** Type a made-up name into a dish dropdown cell of `act_meal_plan` (for example "Ghost"), then run
      **Check links**. It lists that cell.

## D. The web app

- [ ] **D1.** Opening the web address as the owner shows the planner on **This Week**.
- [ ] **D2.** Add a dish with a pasted recipe (Dishes > Add dish > paste > Read pasted recipe > Save). The recipe,
      amounts and steps appear, and a healthy score is shown.
- [ ] **D3.** On **Plan**, press **Suggest meals**. Meals appear. Press **Keep** on one and **Suggest meals** again:
      only the others change. Press **Save plan**. They appear on **This Week**.
- [ ] **D4.** Reload the page in the middle of planning (before Save plan). Your picks come back with a note saying
      the draft was restored.
- [ ] **D5.** On **This Week**, **Recipe** opens the recipe. Changing servings changes the amounts and keeps the
      boxes you ticked.
- [ ] **D6.** Mark a night **Eat out**. A restaurant can be picked, suggested (5 at a time, then 5 more) or typed in.
      If a meal was planned that night, you are asked what to do with it.
- [ ] **D7.** **Shopping** groups items by aisle. Staples such as salt are under "Already have". Tick **In cart** on
      an item: it is crossed out. Change an item's aisle with **Just this list**: it stays in that aisle after you
      refresh.
- [ ] **D8.** **Email list** to yourself arrives, grouped by aisle.

## E. Another family member

- [ ] **E1.** Add a second Google account in `cfg_members` and share the sheet with it as Editor. That person opens
      the web address, goes through Google's "unverified app" screens (once), and sees the planner.
- [ ] **E2.** A Google account that is **not** in `cfg_members` sees "No access".
- [ ] **E3.** Rate a dish and add a comment as the second person. Both people's ratings show on the dish (average).
- [ ] **E4.** Both people save a plan at nearly the same moment. Neither gets an error other than, at worst, "busy,
      try again".

## F. The kitchen tablet

- [ ] **F1.** Open the web address on the tablet and add it to the home screen. It opens on **This Week**.
- [ ] **F2.** Leave it overnight. In the morning it shows the new day without being touched (it checks every few
      minutes and moves on at midnight).
- [ ] **F3.** Open a recipe. The screen stays awake while the recipe is open. (If not, that is acceptable; the
      browser may not allow it inside Google's page.)

## If something fails

- **Setup fails with "argument too large" or similar:** run `setupAll` again once. The app already switches to a
  slower, safer method after the first refusal. If it still fails, note which tab it stopped on.
- **A dropdown is empty:** wait ten seconds and click again, because the hidden lists are formulas. If still empty,
  open the hidden `sys_lists` tab (right-click the tab bar, Show hidden sheets) and note which column is empty.
- **The web app says "No access" for the owner:** open `cfg_members` and make sure your exact Google email is in it.
