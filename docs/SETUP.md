# Setting up the Family Meal Planner

This takes about 30 minutes, once. You need a Google account (a normal Gmail account is fine) and a
computer. Nothing here costs money and nothing needs a command line.

You will create two small Google Apps Script projects. Think of them as two helper programs that
Google runs for you:

- **The web app** is the planner itself. This is the page your family opens.
- **The sheet helper** adds a "Meal Planner" menu to the spreadsheet, keeps links correct when you rename
  things by hand, and makes backups.

Everything you paste comes from the `dist` folder of this project:

| File | Goes into |
|---|---|
| `Server.gs` | the web app project |
| `index.html` | the web app project |
| `appsscript.json` | the web app project |
| `Bound.gs` | the sheet helper project |
| `bound_appsscript.json` | the sheet helper project |

Open each file in a text editor, select everything (Ctrl+A or Cmd+A), and copy it.

---

## Part 1. Create the web app

1. Go to **script.google.com** and sign in. Click **New project**. Click the title at the top and name it
   **Family Meal Planner**.
2. In the left list you will see `Code.gs`. Click it, select everything in the editor, delete it, and paste the
   whole contents of **`Server.gs`**. Press **Ctrl+S** (Cmd+S on Mac) to save.
3. Next to **Files**, click the **+** and choose **HTML**. Type the name `index` (do not type `.html`) and press
   Enter. Select everything in the new file, delete it, and paste the contents of **`index.html`**. Save.
4. Click the **gear icon (Project Settings)** on the left. Tick **Show "appsscript.json" manifest file in
   editor**. Go back to **Editor** (the `<>` icon). Click `appsscript.json`, delete its contents, and paste the
   contents of **`appsscript.json`**. Save.
5. At the top, choose the function **`setupAll`** in the dropdown next to the Run button, then click **Run**.
6. Google asks you to review permissions. Click **Review permissions**, choose your account, then click
   **Advanced**, then **Go to Family Meal Planner (unsafe)**, then **Allow**. This warning appears because you
   wrote the script yourself and Google has not reviewed it. It is normal.
7. Wait for "Execution completed". This can take a minute or two. If it stops with an error or a time-out, just run
   `setupAll` again: it picks up where it left off and never duplicates or erases anything. Click **Execution log** at the bottom. It shows a line starting with
   *Family Meal Planner sheet:* followed by a web address. That is your planner's database. Open it.

## Part 2. Add your family

1. In the spreadsheet, open the **`cfg_members`** tab (orange). Your own row is already there as an admin.
2. Add a row for each family member: their **name** (as you want it shown), their **Google email**, and the
   **role** (`member`, or `admin` if they should be allowed to re-run setup).
3. Click the green **Share** button at the top right of the spreadsheet. Add each family member's email and set
   them to **Editor**. Everyone who uses the planner needs this, because the planner works as them.

## Part 3. Add the sheet helper (menu, safe renames, backup)

1. In the spreadsheet, click **Extensions > Apps Script**. A new tab opens.
2. Replace the contents of `Code.gs` with **`Bound.gs`**. Save.
3. Click the gear icon, tick **Show "appsscript.json" manifest file in editor**, go back to the editor, open
   `appsscript.json`, and paste the contents of **`bound_appsscript.json`**. Save.
4. Close that tab and reload the spreadsheet. After a few seconds a **Meal Planner** menu appears.
5. Try **Meal Planner > Back up now**. The first time, Google asks the owner (you) for permission to use Drive,
   the same way as before. Only the owner ever sees this. Your family never does.

The backup copies the spreadsheet into a Drive folder called **Meal Planner Backups** and keeps the newest 8.
Only the spreadsheet owner can run it. Run it whenever you like, for example every Sunday after planning. Google
Sheets also keeps its own history: **File > Version history > See version history**.

## Part 4. Publish the web app

1. Go back to the web app project (the first one). Click **Deploy > New deployment**.
2. Click the gear next to **Select type** and choose **Web app**.
3. Set **Execute as** to **User accessing the web app** and **Who has access** to **Anyone**. ("Anyone" only
   means anyone signed in to Google can reach the page. The planner then lets in only the people listed in
   `cfg_members`.)
4. Click **Deploy**, authorize if asked, and copy the **Web app URL**. Bookmark it.

## Part 5. Each family member

1. Open the Web app URL on your phone or computer and sign in to Google.
2. Google shows "Google hasn't verified this app". Click **Advanced**, then **Go to Family Meal Planner
   (unsafe)**, then **Allow**. This happens once per person.
3. If you see **No access**, the email is not in `cfg_members` yet.

**What each person is agreeing to.** The planner needs three permissions: to see your email address (to know who
you are), to send email as you (only when you press Email list), and to see, edit, create and delete Google
Sheets spreadsheets. That last one is how Google words it, and it covers *all* of that person's spreadsheets, not
only the planner's. The planner only ever opens its own sheet, but Google cannot limit the permission any
further for this kind of script. Only share the link with people you would trust with that. Anyone can take the
permission back at any time at **myaccount.google.com/permissions**.

## Part 6. The kitchen tablet

1. Sign in on the tablet with a Google account that is listed in `cfg_members` and shared on the spreadsheet.
   A shared household account works well.
2. Open the Web app URL. It opens on **This Week** and updates itself every few minutes. At midnight it moves on
   to the new day by itself. If it ever looks stale, tap **Refresh**.
3. In Chrome, use **Add to Home screen** (or Install) and open it from there for a full-screen look. In the
   recipe view the tablet tries to keep the screen awake while a recipe is open.

## Check that it all works

Before the family starts, go through `docs/GOOGLE_CHECKLIST.md` once. It is a short list of things to try that
only real Google can confirm.

---

## Day to day

- **Plan** (Saturday or Sunday): open **Plan**, press **Suggest meals**, press **Keep** on the nights you like,
  press **Suggest meals** again to refill only the other nights, then **Save plan**. Your draft saves itself as you
  go, so you can close the page and come back.
- **Budget mode** on the Plan tab switches between the weighting profiles in `cfg_type_weights`.
- **Shopping** builds from the saved plan, grouped by aisle. Staples are pre-ticked "Have it".

## Changing things in the sheet

- **Settings:** `cfg_settings`. Change the `value` column.
- **Variety rules:** `cfg_variety_rules`. Untick `active` to switch a rule off, or change the `limit`.
- **Budget profiles:** `cfg_profiles` and `cfg_type_weights` (1 is normal, 0.5 half as likely, 2 twice as likely).
- **Store aisles:** `cfg_aisles`. Change `sort_order` to match how you walk through your store.
- **Healthy score points:** `cfg_health_rules`. Afterwards press **Recalculate healthy scores** at the bottom of the Dishes tab.
- **Renaming:** rename a dish, restaurant or ingredient in the app (Rename button) or by typing a new name in the
  sheet. Every place that uses it follows the new name. Names must be unique.
- **Grey columns** (`plan_id`, `queue_id`, `item_id`) belong to the app. Please do not edit them.
- **Meal Planner > Check links** lists anything that points at a name that no longer exists. Use it if you paste
  over many names at once or delete a name.
- Changes you type into the sheet can take up to a minute to show up in the app.

## Updating later

When you receive new files: paste the new `Server.gs` and `index.html` over the old ones in the web app project,
then **Deploy > Manage deployments**, click the pencil, set **Version** to **New version**, and **Deploy**. The web
address stays the same. Update the sheet helper the same way with `Bound.gs`.

## Good to know

- Sheet dropdowns show names, never codes, and are always sorted A to Z. Dropdowns in the app are A to Z too. (The
  shopping list itself stays in the order you walk through the store.) If you type directly into the sheet, pick
  from the dropdown.
- Email goes out from the Gmail of whoever presses Send. Gmail allows roughly 100 emails a day.
- To use a different time zone, change `timezone` in `cfg_settings` and the `timeZone` line in `appsscript.json`
  of both projects.
- If the planner says it is busy, wait a few seconds and try again. Two people saved at the same moment.
