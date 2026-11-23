import { Router } from 'express';
import { auth, role } from '../middleware/auth.js';

import * as A from '../controllers/authController.js';
import * as S from '../controllers/systemController.js';
import * as P from '../controllers/paymentController.js';

const r = Router();

// AUTHENTICATION
r.post('/auth/admin-setup', A.setupAdmin);
r.post('/auth/register', A.registerCustomer);
r.post('/auth/login', A.login);
r.get('/me', auth, A.me);

// DASHBOARD
r.get('/dashboard', auth, S.dashboard);

// STAFF
r.post('/staff', auth, role('admin'), S.createStaff);
r.get('/staff', auth, S.listStaff);
r.patch('/staff/:id/deactivate', auth, role('admin'), S.deactivateStaff);

// ORDERS
r.post('/orders', auth, role('customer'), S.createOrder);
r.patch('/orders/:id/status', auth, role('admin', 'staff'), S.updateOrder);

// ORDER PAYMENT
r.post('/orders/:id/payments', auth, role('admin', 'customer'), P.recordPayment);

// INVENTORY
r.get('/inventory', auth, S.inventoryList);
r.post('/inventory', auth, role('admin'), S.createInventory);
r.patch('/inventory/:id', auth, role('admin'), S.updateInventory);
r.patch('/inventory/:id/add-stock', auth, role('admin'), S.addInventoryStock);
r.patch('/inventory/:id/deduct-stock', auth, role('admin'), S.deductInventoryStock);
r.post('/inventory/:id/buy', auth, role('admin'), S.buyInventoryItem);
r.get('/inventory/summary', auth, role('admin'), S.getInventorySummary);
r.get('/inventory/purchases', auth, role('admin'), S.getInventoryPurchaseHistory);

// REPORTS
r.get('/reports', auth, role('admin'), S.reports);

// STAFF ORDERS
r.get('/staff/orders', auth, role('staff'), S.staffOrders);

// ROUTE HANDLER CHECK
console.log('ROUTE CHECK:', {
  setupAdmin: typeof A.setupAdmin,
  registerCustomer: typeof A.registerCustomer,
  login: typeof A.login,
  dashboard: typeof S.dashboard,
  createStaff: typeof S.createStaff,
  listStaff: typeof S.listStaff,
  deactivateStaff: typeof S.deactivateStaff,
  createOrder: typeof S.createOrder,
  updateOrder: typeof S.updateOrder,
  inventoryList: typeof S.inventoryList,
  createInventory: typeof S.createInventory,
  updateInventory: typeof S.updateInventory,
  addInventoryStock: typeof S.addInventoryStock,
  deductInventoryStock: typeof S.deductInventoryStock,
  buyInventoryItem: typeof S.buyInventoryItem,
  getInventorySummary: typeof S.getInventorySummary,
  getInventoryPurchaseHistory: typeof S.getInventoryPurchaseHistory,
  reports: typeof S.reports,
  staffOrders: typeof S.staffOrders,
  recordPayment: typeof P.recordPayment,
});

export default r;
