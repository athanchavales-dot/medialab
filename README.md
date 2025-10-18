# Oak Hill Media Lab – Merged PLUS + Submissions

This build merges:
- Rubrics/Badges, Certificate, Comments, Guardian view, Inline media previews, Stage resources
- AND per-stage **Worksheets** with **Submit for review** (Student) and **Approve/Return** (Teacher).

## Quick start (GitHub Pages)
1) Upload all files to a GitHub repo (root).  
2) Settings → Pages → Deploy from branch → main → /(root).  
3) Open your Pages URL.  
4) Admin (demo): `admin@oakhill.local` / `admin123`

## Admin
- Create Students / Teachers / Guardians.  
- Settings → paste URLs for stage resources (DOCX/PPTX/PDF).

## Teacher
- Dashboard → Open student → view **Worksheet Submission** (status, answers), **Rubric**, **Feedback**, **Comments**.  
- **Approve Stage** or **Return for edits**; students see current status.

## Student
- Open stage → **Open Worksheet**, fill & **Save Draft**.  
- **Submit for review** when ready; teacher can return or approve.  
- Complete all stages, then **Generate Certificate**.

## Storage
- Offline-first via IndexedDB (demo). Replace with Firebase for real multi-device sync.
