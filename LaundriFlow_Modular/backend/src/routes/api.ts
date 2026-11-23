import { Router } from 'express';
import { auth, role } from '../middleware/auth.js';

import * as A from '../controllers/authController.js';
import * as S from '../controllers/systemController.js';

import * as P from '../controllers/paymentController.js';

const r = Router();

// ==========================
// AUTHENTICATION
// ==========================
r.post('/auth/admin-setup', A.setupAdmin);
r.post('/auth/register', A.registerCustomer);
r.post('/auth/login', A.login);

r.get('/me', auth, A.me);

// ==========================
// DASHBOARD
// ==========================
r.get('/dashboard', auth, S.dashboard);

// ==========================
// STAFF
// ==========================
r.post('/staff', auth, role('admin'), S.createStaff);
r.get('/staff', auth, S.listStaff);
r.patch('/staff/:id/deactivate', auth, role('admin'), S.deactivateStaff);

// ==========================
// ORDERS
// ==========================
r.post('/orders', auth, role('customer'), S.createOrder);
r.patch('/orders/:id/status', auth, role('admin', 'staff'), S.updateOrder);

// ==========================
// ORDER PAYMENT
// ==========================
r.post(
  '/orders/:id/payments',
  auth,
  role('admin', 'customer'),
  P.recordPayment
);


// ==========================
// REPORTS
// ==========================
r.get('/reports', auth, role('admin'), S.reports);

// ==========================
// STAFF ORDERS
// ==========================
r.get('/staff/orders', auth, role('staff'), S.staffOrders);

export default r;
console.log('POST ROUTE CHECK:', {
  setupAdmin: typeof A.setupAdmin,
  registerCustomer: typeof A.registerCustomer,
  login: typeof A.login,
  createStaff: typeof S.createStaff,
  createOrder: typeof S.createOrder,
  recordPayment: typeof P.recordPayment
});