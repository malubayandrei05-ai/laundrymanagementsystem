# LaundriFlow — Expo Go Complete Starter

This project keeps the original LaundriFlow Deep Forest & Mint visual direction and provides separate Admin and Customer workspaces.

## Included
- Separate Admin and Customer login roles
- Customer self-registration with a unique customer ID
- Admin dashboard: order totals, collected revenue, customer count, active orders
- Order management: laundry progress, pickup/delivery status
- Payment tracking: unpaid, partially paid, paid, amount paid and remaining balance
- Products and service price listing
- Inventory stock view and stock adjustment
- Staff on-duty list
- Customer portal: create orders, view only their own orders, track status and outstanding balance
- AsyncStorage persistence for a classroom/demo build

## Run in Expo Go
1. Install Node.js LTS and extract this ZIP.
2. Open this folder in VS Code.
3. Run `npm install`.
4. Run `npx expo install --fix`.
5. Run `npx expo start`.
6. Scan the QR code using Expo Go. Keep your phone and computer on the same Wi-Fi.

## Demo login
- Admin: `admin` / `admin123`
- Customer: `customer` / `cust123`
- Or create a new customer account from the login screen.

## Important security and data limitation
This version is an Expo Go **local-storage prototype**. AsyncStorage stores data on the device. It is useful for demonstrating role-based screens and workflows, but it is NOT production authentication, not safe for real customer data, and does not synchronize different phones. A customer account created on one phone will not automatically appear on the Admin's phone.

For actual secure multi-user operation, connect this Expo app to a shared API and database (for example ASP.NET Core Web API + MySQL), store salted password hashes server-side, enforce role and customer ownership checks on every API endpoint, and use HTTPS. Do not use the demo credentials in production.

## Main source
- `App.tsx` — screens, role-based navigation, sample data, order/payment/inventory workflows
- `src/theme.ts` — original theme palette
