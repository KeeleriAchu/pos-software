# 🏪 POS Manager — React Web App

A full-featured Point of Sale web app built with **React + Vite + Supabase**.

---

## ✅ Features

| Feature | Details |
|---|---|
| 🔐 Auth | Login / Sign up with Supabase Auth |
| 📊 Dashboard | Today's sales, pending dues, recent bills |
| 🧾 Billing | Product cart, payment methods, WhatsApp bill send |
| 👥 Customers | Add / edit / delete, pending amount display |
| 📦 Products | Add / edit / delete with categories |
| ⏳ Pending | Track dues, collect payments, send WhatsApp reminders |
| 📈 Reports | Sales charts, top products, all-time summary |
| 🔔 Reminders | Bulk WhatsApp reminders with customer selection |
| ⚙️ Settings | Shop info, API keys, Supabase status |

---

## 🚀 How to Run

### 1. Install Node.js
Download from https://nodejs.org (choose LTS version)

### 2. Extract this folder
Put `pos-react` folder anywhere on your PC.

### 3. Open terminal in the folder
In VS Code: open the `pos-react` folder → press **Ctrl + `** to open terminal

### 4. Install dependencies
```bash
npm install
```

### 5. Start the app
```bash
npm run dev
```

### 6. Open in browser
Go to: **http://localhost:5173**

---

## 🔑 Supabase Credentials

Your credentials are already set in `src/services/supabase.js`:

```
URL: https://urlqmabfldpakiyjndsr.supabase.co
Key: sb_publishable_Lf6ZZH2jcJ7WyEGYU87xcQ_uBvfBcr-
```

Make sure the SQL tables are created in your Supabase project (use STEP1_supabase_setup.sql).

---

## 📁 Project Structure

```
pos-react/
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── main.jsx          ← Entry point
    ├── App.jsx           ← Routes
    ├── index.css         ← All styles
    ├── context/
    │   └── AuthContext.jsx
    ├── services/
    │   ├── supabase.js   ← Supabase client
    │   └── api.js        ← All DB functions
    ├── components/
    │   ├── layout/
    │   │   └── Sidebar.jsx
    │   └── ui/
    │       └── Toast.jsx
    └── pages/
        ├── Login.jsx
        ├── Dashboard.jsx
        ├── Billing.jsx
        ├── Customers.jsx
        ├── Products.jsx
        ├── Pending.jsx
        ├── Reports.jsx
        ├── Reminders.jsx
        └── Settings.jsx
```

---

## 🏗️ Build for Production

```bash
npm run build
```

Output goes to `dist/` folder. You can host it on:
- **Netlify** — drag & drop the `dist` folder at netlify.com
- **Vercel** — `npx vercel` in the project folder
- **Any web host** — upload `dist` contents

---

## 📱 WhatsApp Integration

No setup needed — uses free `wa.me` links. When you click "Send WhatsApp", it opens WhatsApp with the message pre-filled.

---

## 💬 Support

If you get errors, check:
1. `npm install` completed without errors
2. Supabase SQL tables are created
3. Internet connection is working
