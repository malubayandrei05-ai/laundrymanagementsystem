# LaundriFlow Web — Frontend + Backend

A fresh web rebuild of the uploaded LaundriFlow Expo prototype. This version does not use Expo Go or React Native. Frontend and Backend are separate applications connected through REST API, with MySQL/MariaDB storage.


## Stack
- Frontend: React, TypeScript, Vite, Axios, Lucide icons
- Backend: Node.js, Express, TypeScript, JWT, bcrypt
- Database: MySQL/MariaDB (XAMPP)

## 1) Database
1. Start MySQL in XAMPP.
2. Open phpMyAdmin (`http://localhost/phpmyadmin`).
3. Import `backend/database/schema.sql`.

## 2) Backend
1. Open a terminal in `backend`.
2. Run `npm install`.
3. Copy `.env.example` to `.env`; adjust MySQL settings if needed.
4. Run `npm run dev`.
5. Backend API runs at `http://localhost:4000`. Check `http://localhost:4000/api/health`.

## 3) Frontend
1. Open a second terminal in `frontend`.
2. Run `npm install`.
3. Run `npm run dev`.
4. Open the Vite URL printed in the terminal (normally `http://localhost:5173`).

## First login
Use **Initial admin setup** on the login page to create the first administrator (password minimum 8 characters). The admin account is stored in MySQL and password is hashed. Customer registration creates customer accounts in the same database.


## Features in this starter rebuild
- Admin and Customer login / account creation
- Admin dashboard KPI cards and live API/database connection indicator
- Customer order submission
- Admin order management, status updates, payment records
- Products and inventory management
- Customer account activation/deactivation
- Staff on-duty list
- Pickup or delivery order type

## Notes
- This is a functional starter foundation; before production use, add stronger authorization rules for customer ownership, rate limiting, CSRF protections if using cookies, input validation, backups, audit logs, payment workflows, and secure HTTPS deployment.
- API currently permits CORS from development origins. Restrict it before deployment.
