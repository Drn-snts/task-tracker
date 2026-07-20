# My Task Tracker

A web version of the "My Task Tracker" spreadsheet — Program, today's date,
task count, a **Pending Tasks** counter (tasks that are `New` or
`Working on it`), a pie chart of tasks by course, and an editable task
table (Deadline, Course, Task Details, Status, Days Left, Priority, Notes,
Finished On). Data is stored in **Firebase Firestore**, so it saves
automatically and updates live if you have it open in two tabs.

No build tools, no npm install — just HTML, CSS and JavaScript, so you can
edit it straight in VS Code and refresh your browser to see changes.

---

## What you'll need

- A **GitHub** account — [github.com/join](https://github.com/join)
- A **Google** account (to create a free Firebase project)
- **VS Code** — [code.visualstudio.com](https://code.visualstudio.com)
- **Git** installed on your computer — [git-scm.com/downloads](https://git-scm.com/downloads)

You do **not** need Node.js for this project.

---

## Step 1 — Create the GitHub repository

1. Go to [github.com/new](https://github.com/new).
2. Repository name: `task-tracker` (or anything you like).
3. Leave it **Public** (or Private, your choice).
4. Do **not** check "Add a README" — leave everything else unchecked.
5. Click **Create repository**. Keep this page open — GitHub will show you
   a page with commands under "…or push an existing repository from the
   command line". You'll use that in Step 6.

## Step 2 — Get the project files onto your computer

Take the project folder you downloaded from this chat and unzip it
somewhere easy to find, e.g. your Desktop. You should see:

```
task-tracker/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── app.js
│   └── firebase-config.js
├── .gitignore
└── README.md
```

## Step 3 — Open it in VS Code

1. Open VS Code.
2. `File → Open Folder…` and select the `task-tracker` folder.
3. You should see the file tree on the left matching the structure above.

## Step 4 — Install the Live Server extension

Because the app uses JavaScript modules (`import`/`export`), you can't just
double-click `index.html` — browsers block modules when opened directly as
a `file://` path. Live Server runs a tiny local web server for you instead.

1. In VS Code, click the **Extensions** icon in the left sidebar (or press
   `Ctrl+Shift+X` / `Cmd+Shift+X`).
2. Search for **"Live Server"** by Ritwick Dey.
3. Click **Install**.

You won't use it until Step 9 — first you need to set up Firebase.

---

## Step 5 — Create a Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
   and sign in with your Google account.
2. Click **Add project** (or **Create a project**).
3. Name it something like `my-task-tracker`, click **Continue**.
4. You can disable Google Analytics for this project (toggle it off) — you
   don't need it. Click **Create project**, then **Continue** once it's ready.

## Step 6 — Create a Firestore database

Firestore is the database that will store your tasks.

1. In the left sidebar of the Firebase console, click **Build → Firestore
   Database**.
2. Click **Create database**.
3. Choose a location close to you and click **Next**.
4. Choose **Start in test mode**, then click **Create**.
   - Test mode means anyone with your config can read/write your data for
     30 days. That's fine while you're building — see **Securing your
     data** below for what to do before sharing the app publicly.

## Step 7 — Register a web app to get your config keys

1. In the Firebase console, click the **gear icon → Project settings**.
2. Scroll down to **Your apps**, click the **`</>`** (Web) icon.
3. Give it a nickname like `task-tracker-web`. Leave "Firebase Hosting"
   unchecked. Click **Register app**.
4. Firebase will show you a code block containing a `firebaseConfig`
   object with `apiKey`, `authDomain`, `projectId`, etc. Keep this page
   open — you need it in the next step.

## Step 8 — Paste your config into the project

1. Back in VS Code, open `js/firebase-config.js`.
2. Replace the placeholder values (`"YOUR_API_KEY"`, etc.) with the real
   values Firebase showed you in Step 7.
3. Save the file (`Ctrl+S` / `Cmd+S`).

This file is safe to keep public/commit to GitHub — these values aren't
secret; your data is protected by the security rules from Step 6, not by
hiding this file.

## Step 9 — Run it locally and test

1. In VS Code's file tree, right-click `index.html`.
2. Click **"Open with Live Server"**.
3. Your browser opens the app. Click **+ Add Task**, fill in a deadline,
   course, and status, and confirm:
   - **Number of Tasks** goes up.
   - **Pending Tasks** goes up only when status is `New` or
     `Working on it` — set a task to `Finished` and watch it drop back down.
   - The pie chart updates as you add courses.
4. Open a second browser tab to the same address — edit a task in one tab
   and watch it appear in the other. That's Firestore's real-time sync.

If you see "Couldn't reach Firebase" at the bottom of the page, double
check Step 8 and that Firestore is created (Step 6).

## Step 10 — Push the project to GitHub

Back in VS Code, open a terminal: `Terminal → New Terminal`.

```bash
git init
git add .
git commit -m "Initial commit: task tracker"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/task-tracker.git
git push -u origin main
```

Replace `YOUR-USERNAME` with your GitHub username (the exact command with
your URL is also shown on the GitHub page from Step 1). Refresh your
GitHub repository page — your files should now be there.

From now on, whenever you make changes:

```bash
git add .
git commit -m "describe what you changed"
git push
```

## Step 11 (optional) — Host it for free with GitHub Pages

So you can open your tracker from your phone too, not just VS Code:

1. On GitHub, open your repository → **Settings → Pages**.
2. Under "Build and deployment", set **Source** to **Deploy from a branch**.
3. Branch: `main`, folder: `/ (root)`. Click **Save**.
4. After a minute, refresh the page — GitHub shows you a live URL like
   `https://YOUR-USERNAME.github.io/task-tracker/`.

---

## Securing your data (do this before sharing the link)

Test mode (Step 6) opens your database to anyone for 30 days, then it
locks everyone out — including you. Before that happens, tighten the
rules:

1. Firebase console → **Build → Firestore Database → Rules**.
2. Replace the rules with something like:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true; // fine for a personal, unlisted app
    }
  }
}
```

This keeps it open (simplest option for a personal tool only you know the
URL to) but won't expire like test mode does. If you want real login
protection later, Firebase Authentication (email/password or Google
sign-in) plus rules like `allow read, write: if request.auth != null;` is
the next step — ask if you'd like help adding that.

---

## How the Pending Tasks counter works

In `js/app.js`:

```js
const PENDING_STATUSES = ["New", "Working on it"];
...
const pending = currentTasks.filter(t => PENDING_STATUSES.includes(t.status)).length;
```

It recalculates every time a task changes, because it runs inside the
Firestore real-time listener. `Finished` tasks are excluded on purpose —
edit the `PENDING_STATUSES` array if you ever want different statuses to
count.

## Project structure

| File | What it does |
|---|---|
| `index.html` | Page structure — stat cards, chart, task table |
| `css/style.css` | The maroon/cream visual styling |
| `js/firebase-config.js` | Your Firebase project keys (edit this one) |
| `js/app.js` | All the logic: reading/writing Firestore, rendering the table, the chart, the Pending Tasks count |

## Troubleshooting

- **Blank page / errors about "import"** → you opened `index.html`
  directly instead of using Live Server. Redo Step 9.
- **"Couldn't reach Firebase"** → check `js/firebase-config.js` values
  match Step 7 exactly, and that you completed Step 6.
- **Data disappeared after ~30 days** → test mode expired; do the
  **Securing your data** section above.
- **Changes not saving** → open your browser's console
  (`F12 → Console` tab) — Firestore errors show up there with details.
