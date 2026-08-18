# BATMAN — 9-Month Personal Transformation Command Center

BATMAN is a mobile-first Progressive Web Application (PWA) designed for tracking and developing 6 personal transformation pillars over a 9-month horizon:

1. **Deen / Islamic Practice**: 5 Daily Prayers (Home/Masjid), Tahajjud streak, Qur'an Morning Tafsir & 3-verse memorization across all 114 Surahs, Qur'an Evening Recitation, Islamic Learning.
2. **Cybersecurity (Offensive Security)**: ADCD Class attendance (Mon–Fri), 4h Deep Work focus timer with daily/weekly/monthly/9M aggregations.
3. **English Communication & IELTS**: 30m fluency focus timer, official IELTS band mock tracker with rounding rules.
4. **Fitness & Body Bulking**: 4 sessions/week gym tracking, body weight tracking with auto-calculated BMI.
5. **Sleep & Recovery**: 7.5h target, 7-day average computation, recovery deficit warnings.
6. **Discipline & Reviews**: Real-time chronological schedule timeline, 1-5 Daily Reviews with reflections, Weekly Summaries with automatic trend detection.

---

## 🛠 Technology Architecture

- **Frontend**: HTML5, Vanilla CSS3 (command-center dark mode), Vanilla ES6+ JavaScript.
- **Client Persistence**: Immediate synchronous LocalStorage with offline sync queue.
- **PWA**: Standalone manifest (`manifest.json`) and cache-first offline service worker (`service-worker.js`).
- **Backend / Database**: Google Apps Script Web App (`backend/Code.gs`) with Google Sheets (15 structured tabs initialized via `backend/Setup.gs`).
- **Deployment**: Zero-build static hosting on **Vercel Hobby**.

---

## 🚀 How to Host on Vercel (Hobby)

### Step 1: Push to GitHub
```bash
git init
git add .
git commit -m "feat: initial release of BATMAN PWA"
git branch -M main
git remote add origin https://github.com/<YOUR_USERNAME>/batman.git
git push -u origin main
```

### Step 2: Deploy to Vercel
1. Go to [vercel.com](https://vercel.com) and log in with your GitHub account.
2. Click **Add New... > Project**.
3. Import your `batman` repository.
4. Framework Preset: select **Other** (Root Directory: `./`, No build command required).
5. Click **Deploy**.
6. Vercel will give you a live production URL (e.g. `https://batman-xxxx.vercel.app`).

---

## 📊 Google Sheets Cloud Sync Setup

1. Create a new Google Sheet in your Google Drive.
2. Open **Extensions > Apps Script**.
3. Copy and paste `backend/Code.gs` into `Code.gs`, and `backend/Setup.gs` into `Setup.gs`.
4. In the Apps Script toolbar, select the function **`setupDatabase`** and click **Run** (this auto-creates and formats all 15 database tabs).
5. Click **Deploy > New deployment**:
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Copy the deployment URL.
7. Open your live BATMAN app on Vercel, go to **More > GOOGLE APPS SCRIPT SYNC**, paste the URL into **Backend Web App URL**, and tap **Test Connection** & **Sync Now**.

---

## 📱 Mobile Installation (PWA)

1. Open your Vercel URL in **Google Chrome** on Android (or Safari on iOS).
2. Tap the browser menu (`⋮` on Chrome / Share button on iOS).
3. Select **Add to Home screen** / **Install app**.
4. Launch BATMAN from your phone's home screen as a standalone full-screen command center.
