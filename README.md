# Donation Plus

פלטפורמת SaaS לניהול תרומות לבתי כנסת — קיוסק, דשבורד גבאי, ניהול אדמין.

## סטאק
- **Frontend:** React 18 + Vite + TailwindCSS + shadcn/ui + PWA
- **Backend:** Node.js + Express + Socket.io
- **DB:** PostgreSQL (Railway) / SQLite (פיתוח מקומי)
- **תשלומים:** Stripe Checkout
- **מדיה:** Cloudinary
- **מייל:** Resend | **SMS:** Twilio

---

## פריסה ל-Railway (פעם ראשונה — ~10 דקות)

### שלב 1 — GitHub
```bash
# בתיקיית הפרויקט donation-plus/
git init
git add .
git commit -m "initial commit: Donation Plus full app"

# צור repo ב-GitHub ואז:
git remote add origin https://github.com/<YOUR_USERNAME>/donation-plus.git
git branch -M main
git push -u origin main
```

### שלב 2 — Railway חשבון
1. כנס ל-**[railway.app](https://railway.app)** → "Login with GitHub"
2. אפשר גישה ל-repo

### שלב 3 — פרויקט חדש ב-Railway
1. לחץ **"New Project"**
2. בחר **"Deploy from GitHub repo"**
3. בחר את ה-repo `donation-plus`
4. Railway יזהה את `railway.json` ויתחיל build אוטומטית

### שלב 4 — PostgreSQL Plugin
1. בפרויקט Railway: לחץ **"+ New"** → **"Database"** → **"PostgreSQL"**
2. Railway יוסיף `DATABASE_URL` אוטומטית לשירות שלך

### שלב 5 — משתני סביבה
בשירות הראשי: **Variables** → הוסף:

```env
NODE_ENV=production

# JWT (צור string אקראי ארוך)
JWT_SECRET=<random-64-char-string>

# Admin ראשוני
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=<strong-password>

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Resend (מייל)
RESEND_API_KEY=re_...

# Twilio (SMS — אופציונלי)
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+1...

# Cloudinary (העלאת תמונות)
CLOUDINARY_URL=cloudinary://api_key:api_secret@cloud_name

# PORT מוגדר אוטומטית על ידי Railway — אל תגדיר ידנית
```

> **טיפ:** `DATABASE_URL` מוגדר אוטומטית על ידי ה-PostgreSQL plugin — אל תגדיר ידנית.

### שלב 6 — הרצת Seed (פעם אחת)
אחרי שה-deploy הצליח, פתח **Terminal** ב-Railway:
```bash
npm run seed
```
זה יצור את האדמין הראשוני לפי `ADMIN_EMAIL` + `ADMIN_PASSWORD`.

### שלב 7 — Stripe Webhook
1. ב-Stripe Dashboard → Webhooks → Add endpoint
2. URL: `https://<YOUR-RAILWAY-URL>/api/stripe/webhook`
3. Events: `checkout.session.completed`, `checkout.session.expired`
4. העתק את `Signing secret` → הוסף כ-`STRIPE_WEBHOOK_SECRET`

---

## Auto-Deploy
כל `git push` ל-`main` מפעיל deploy אוטומטי תוך ~60 שניות.

```bash
# שינוי קוד ← push ← Railway builds ← אוטומטי
git add .
git commit -m "your change"
git push origin main
```

---

## הרצה מקומית (פיתוח)

### דרישות
- Node.js 18+
- PostgreSQL (או שנה ל-SQLite — ראה הערה למטה)

### התקנה
```bash
# 1. Server
cd server
cp .env.example .env
# ערוך .env עם הפרטים שלך
npm install
npx prisma migrate dev
node src/seed.js

# 2. Client (טרמינל נפרד)
cd client
npm install
npm run dev
```

### SQLite במקום PostgreSQL (ללא התקנת PostgreSQL)
בקובץ `server/prisma/schema.prisma` שנה:
```prisma
datasource db {
  provider = "sqlite"   # ← שנה מ-postgresql
  url      = env("DATABASE_URL")
}
```
ב-`server/.env`:
```
DATABASE_URL=file:./dev.db
```

---

## URLs
| סביבה | כתובת |
|-------|--------|
| **Production** | `https://<YOUR-RAILWAY-URL>` |
| **Dev client** | `http://localhost:5173` |
| **Dev server** | `http://localhost:3001` |

## כניסות
| תפקיד | כתובת | פרטים |
|--------|--------|--------|
| אדמין | `/admin/login` | מה-.env |
| גבאי | `/login` | נוצר על ידי אדמין |
| קיוסק | `/kiosk/:id` | ציבורי |

---

## מבנה הפרויקט
```
donation-plus/
├── client/          React + Vite (PWA)
├── server/          Express + Prisma + Socket.io
├── railway.json     הגדרות Railway
├── package.json     Build & start scripts
└── README.md
```
