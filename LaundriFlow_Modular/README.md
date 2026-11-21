# LaundriFlow Modular Rebuild

A role-separated laundry management starter rebuilt around the requirements discussed:

- **Admin**: one-time setup; dashboard; view all orders; record partial/full payments; manage inventory; create/deactivate staff; view reports.
- **Customer**: self-register; customer codes such as `CUSTOMER-01`, `CUSTOMER-02`; own dashboard/orders; create laundry orders; choose Pickup or Delivery; choose delivery staff for Delivery; see paid/balance/payment status.
- **Staff / Rider**: can log in only if Admin has created their account; see only assigned Delivery orders; backend allows assigned staff to mark their own delivery as `Delivered`. Admin cannot set `Delivered` in this implementation.
- Backend authorization checks roles and ownership; payment records are kept in a `payments` table.

## Requirements
Node.js (LTS), XAMPP/MySQL, VS Code.

## 1. Database
1. Start MySQL in XAMPP.
2. Open phpMyAdmin at http://localhost/phpmyadmin.
3. Import `backend/database/schema.sql`.

## 2. Backend
Open a terminal in `backend`:

```powershell
copy .env.example .env
npm install
npm run dev
```
Edit `.env` if your MySQL credentials differ. API is http://localhost:4000/api. Check http://localhost:4000/api/health.

## 3. Frontend
Open a second terminal in `frontend`:

```powershell
npm install
npm run dev
```
Open the Vite URL printed in terminal (normally http://localhost:5173).

## 4. Initial Admin
On the login page, choose **Initial admin setup**. Setup works only when no admin exists. Make a unique username and password (8+ characters).

## 5. Create Staff accounts
Login as Admin > Staff. Create a staff account with name, username, password, and type. Staff cannot register themselves. Use type `Delivery / Rider` for delivery assignments.\n

## 6. Create Customer account
Customer can use **Create customer account** from the login page. Customer code is assigned sequentially: `CUSTOMER-01`, etc. It displays in profile and customer order list.


## Features / Notes
- Pricing defaults in API: Wash, Dry & Fold ₱50/kg; Wash & Dry ₱40/kg; Wash Only ₱30/kg; Dry Cleaning ₱100/kg.
- Payments are **recorded by Admin**, not customers. Admin can enter any amount up to remaining balance. Payment status is calculated from paid versus total.
- Pickup orders don't require a rider. Delivery orders require an active delivery staff member at order creation.
- Inventory currently supports add/list; product update endpoint exists for quantity and price.
- Reports currently show all orders with summary counts and totals.
- This is a local demo system, not a live payment gateway. Admin manually records cash/other payment received.
