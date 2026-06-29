# Truma Plus Kiosk — Mobile App (Tap to Pay)

אפליקציית React Native / Expo המאפשרת תשלום NFC על הטאבלט/טלפון ישירות,
ללא קורא חומרה נוסף, בשימוש ב-Stripe Terminal SDK.

## זרימת תשלום

1. הגבאי פותח את האפליקציה → מכניס את מזהה בית הכנסת (חד פעמי)
2. האפליקציה מתחברת ל-NFC של המכשיר דרך Stripe Terminal
3. התורם בוחר סוג תרומה + סכום → לוחץ "הצמד לתשלום"
4. **מצמיד כרטיס בנקאי / iPhone (Apple Pay) / Android (Google Pay)**
5. מסך הצלחה → חזרה אוטומטית לבחירה

---

## דרישות

| מה | גרסה מינימלית |
|---|---|
| Node.js | 18+ |
| iPhone | XS ומעלה, iOS 16+ |
| Android | NFC + Android 6+ |
| Expo account | חינם — expo.dev |
| Apple Developer | $99/שנה (לבנייה ל-iOS) |
| Stripe | Live mode מופעל |

---

## שלב 1 — התקנה

```bash
cd mobile
npm install
```

---

## שלב 2 — הגדרת כתובת השרת

ערוך `src/api/client.ts`:

```ts
const BASE_URL = __DEV__
  ? 'http://YOUR_LOCAL_IP:3001/api'   // ← IP של המחשב שלך ברשת המקומית
  : 'https://truma-plus-production.up.railway.app/api';
```

כדי לדעת את ה-IP:
- Windows: `ipconfig` → "IPv4 Address"
- Mac/Linux: `ifconfig en0` → "inet"

---

## שלב 3 — Expo + EAS

```bash
# התחבר ל-Expo
npx expo login

# קשר את הפרויקט (פעם ראשונה)
npx eas init

# עדכן את projectId ב-app.json → extra.eas.projectId
```

---

## שלב 4 — בנייה

### פיתוח (Development Build) — לבדיקה על מכשיר אמיתי
```bash
npx eas build --platform ios --profile development
# או
npx eas build --platform android --profile development
```

### פרודקשן
```bash
npx eas build --platform ios --profile production
npx eas build --platform android --profile production
```

---

## שלב 5 — הגדרת Stripe Terminal

1. כנס ל-[dashboard.stripe.com/terminal](https://dashboard.stripe.com/terminal)
2. ודא שה-account שלך הוא **Live mode**
3. **Tap to Pay on iPhone** מופעל אוטומטית — אין צורך בהגדרה נוספת מ-Apple

---

## שלב 6 — מזהה בית הכנסת

1. כנס ל-Dashboard הגבאי → הגדרות
2. סעיף **"מזהה קיוסק"** → העתק את המזהה
3. בהפעלה ראשונה של האפליקציה → הכנס את המזהה

---

## לאיפוס מזהה בית הכנסת (שינוי קיוסק)

לחץ לחיצה ארוכה (5 שניות) על הכותרת העליונה → מסך ההגדרה יפתח מחדש.

---

## מבנה הקוד

```
mobile/
  App.tsx                         ← root: AsyncStorage check, StripeTerminalProvider
  src/
    api/client.ts                 ← Axios client (server URL config)
    screens/
      SetupScreen.tsx             ← הגדרה ראשונית (מזהה בית הכנסת)
      KioskScreen.tsx             ← קיוסק ראשי + Tap to Pay flow
```

---

## API Server (נוסף אוטומטית)

| Endpoint | תיאור |
|---|---|
| `POST /api/stripe/terminal/connection-token` | חיבור SDK |
| `POST /api/stripe/terminal/payment-intent` | יצירת תשלום |
| `POST /api/stripe/terminal/payment-intent/:id/complete` | סיום תשלום |
