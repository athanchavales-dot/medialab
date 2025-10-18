# Oak Hill Media Lab (SEN-friendly)

An offline-first, role-based web app for digitising the Media Lab process
(Development → Pre-Production → Production → Post-Production).

## Features
- Student, Teacher, Admin dashboards
- IndexedDB storage for files & progress (works offline)
- Exports: CSV (teacher), JSON (student)
- Accessibility: high contrast, dyslexia-friendly font toggle, ARIA, keyboard nav
- PWA (installable)

## Local run
Open `index.html` via a local server (needed for service worker):
```bash
python -m http.server 8080
# then go to http://localhost:8080
```

## GitHub Pages (testing)
1. Create a new repo (e.g., `media-lab`), add all files.
2. Push to **main**.
3. Settings → Pages → Source: `Deploy from a branch` → Branch: `main` → `/ (root)`.
4. Open your GitHub Pages URL.

## Admin (demo)
- Default admin is seeded:
  - Email: `admin@oakhill.local`
  - Password: `admin123`
- Use Admin → Create User to add Teachers/Students.

## Switching to Firebase Auth + Firestore (optional)
To move beyond demo auth and enable multi-device syncing:
- Create Firebase project → enable **Email/Password** in Authentication.
- Create a Firestore database (rules to allow only owner/teacher access).
- Replace demo auth/storage in `app.js` with Firebase:
  - `import` Firebase modules
  - swap login/signup to `signInWithEmailAndPassword`
  - swap IndexedDB project/file ops to Firestore/Storage
- Keep the **same UI and flows**; only data providers change.

## Data model (current IndexedDB)
- `users`: `{ email, name, role: 'student'|'teacher'|'admin', pass: hash }`
- `projects`: `{ id: email, stages: { development:{completed,notes,feedback}, ... } }`
- `files`: `{ id, email, stage, name, type, blob }`
- `settings`: `{ key:'uploads', pdf, images, video }`

## Accessibility notes
- Large text, high-contrast, clear focus states
- Dyslexia font toggle (fallback to system if font missing)
- Plain language labels & emojis for stage recognition
- All actions keyboard accessible

## License
MIT
