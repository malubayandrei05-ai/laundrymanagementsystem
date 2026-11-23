import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Activity,
  ChartNoAxesCombined,
  ClipboardList,
  Droplets,
  LogOut,
  Package,
  Plus,
  Shirt,
  Truck,
  Users,
  Wallet,
  UserRound,
  Home,
  CheckCircle
} from 'lucide-react';

const API = 'http://localhost:4000/api';

type User = {
  id: number;
  full_name: string;
  username: string;
  role: 'admin' | 'customer' | 'staff';
  customer_code?: string;
};

type Order = {
  id: number;
  order_code: string;
  customer_name: string;
  customer_code: string;
  service: string;
  weight: number;
  total: number;
  amount_paid: number;
  fulfillment: 'Pickup' | 'Delivery';
  delivery_staff_id: number | null;
  delivery_staff_name?: string;
  status: string;
  created_at: string;
};

type Staff = {
  id: number;
  full_name: string;
  username: string;
  staff_type: string;
};

type Product = {
  id: number;
  name: string;
  unit: string;
  quantity: number;
  price: number;
};

const fmt = (n: number) =>
  '₱' +
  Number(n || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

const services = [
  ['Wash, Dry & Fold', 50],
  ['Wash & Dry', 40],
  ['Wash Only', 30],
  ['Dry Cleaning', 100]
] as const;

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('lf-token') || '');
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({
    full_name: '',
    username: '',
    password: ''
  });
  const [page, setPage] = useState('Dashboard');
  const [orders, setOrders] = useState<Order[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [orderForm, setOrderForm] = useState<{
    service: string;
    weight: string;
    fulfillment: string;
    delivery_staff_id: string;
  }>({
    service: services[0][0],
    weight: '1',
    fulfillment: 'Pickup',
    delivery_staff_id: ''
  });

  const [staffForm, setStaffForm] = useState({
    full_name: '',
    username: '',
    password: '',
    staff_type: 'delivery'
  });

  const [productForm, setProductForm] = useState({
    name: '',
    unit: 'pcs',
    quantity: '',
    price: ''
  });

  const [payOrder, setPayOrder] = useState<Order | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [report, setReport] = useState<any>(null);

  const http = axios.create({ baseURL: API });

  const call = async (method: string, path: string, data?: any) => {
    const r = await http.request({
      method,
      url: path,
      data,
      headers: token
        ? { Authorization: `Bearer ${token}` }
        : {}
    });

    return r.data;
  };

  function logout() {
    localStorage.removeItem('lf-token');
    setToken('');
    setUser(null);
    setOrders([]);
    setStaff([]);
    setProducts([]);
    setReport(null);
    setError('');
    setPage('Dashboard');
    setMode('login');
  }

  useEffect(() => {
    if (!token) return;

    call('get', '/me')
      .then((u: User) => {
        setUser(u);
        load(u);
      })
      .catch(() => logout());
  }, [token]);

  async function load(u: User | null = user) {
    const current = u;
    const tasks: Promise<void>[] = [];

    // STAFF / RIDER: Load ONLY their own assigned deliveries
    if (current?.role === 'staff') {
      tasks.push(
        (async () => {
          try {
            const result = await call('get', '/staff/orders');

            const staffOrders = Array.isArray(result)
              ? result
              : Array.isArray(result?.orders)
              ? result.orders
              : [];

            setOrders(staffOrders);
            setProducts([]);
            setStaff([]);
            setReport(null);
          } catch (e: any) {
            setOrders([]);
            setError(
              e.response?.data?.message ||
                'Could not load assigned deliveries'
            );
          }
        })()
      );
    } else {
      // ADMIN / CUSTOMER: normal dashboard data
      tasks.push(
        (async () => {
          try {
            const d = await call('get', '/dashboard');
            setOrders(d.orders || []);
            setProducts(d.products || []);
          } catch (e: any) {
            setError(
              e.response?.data?.message ||
                'Could not load dashboard data'
            );
          }
        })()
      );
    }

    // Admin and customers load staff list
    if (current?.role === 'admin' || current?.role === 'customer') {
      tasks.push(
        (async () => {
          try {
            const s = await call('get', '/staff');
            const staffList = Array.isArray(s) ? s : [];

            setStaff(
              current?.role === 'customer'
                ? staffList.filter(
                    (item: Staff) =>
                      String(item.staff_type).toLowerCase() === 'delivery'
                  )
                : staffList
            );
          } catch (e: any) {
            setStaff([]);
            setError(
              e.response?.data?.message || 'Could not load staff list'
            );
          }
        })()
      );
    } else {
      setStaff([]);
    }

    // Admin reports
    if (current?.role === 'admin') {
      tasks.push(
        (async () => {
          try {
            const rr = await call('get', '/reports');
            setReport(rr);
          } catch {
            setReport(null);
          }
        })()
      );
    } else {
      setReport(null);
    }

    await Promise.all(tasks);
  }

  async function authSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);

    try {
      const route =
        mode === 'adminsetup'
          ? '/auth/admin-setup'
          : mode === 'register'
          ? '/auth/register'
          : '/auth/login';

      const payload =
        mode === 'login'
          ? {
              username: form.username.trim(),
              password: form.password
            }
          : {
              full_name: form.full_name.trim(),
              username: form.username.trim(),
              password: form.password
            };

      const response = await http.post(route, payload);
      const data = response.data;

      if (!data.token || !data.user) {
        throw new Error('Invalid login response from server.');
      }

      localStorage.setItem('lf-token', data.token);

      setUser(data.user);
      setToken(data.token);

      setForm({
        full_name: '',
        username: '',
        password: ''
      });

      setMode('login');
      setError('');
    } catch (e: any) {
      localStorage.removeItem('lf-token');
      setToken('');
      setUser(null);

      setForm({
        full_name: '',
        username: '',
        password: ''
      });

      setError(
        e.response?.data?.message ||
          e.message ||
          'Authentication failed. Check your username and password.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function createOrder(e: React.FormEvent) {
    e.preventDefault();

    try {
      await call('post', '/orders', {
        ...orderForm,
        weight: Number(orderForm.weight),
        delivery_staff_id:
          orderForm.fulfillment === 'Delivery'
            ? Number(orderForm.delivery_staff_id)
            : null
      });

      setPage('My Orders');

      setOrderForm({
        service: services[0][0],
        weight: '1',
        fulfillment: 'Pickup',
        delivery_staff_id: ''
      });

      await load();
    } catch (e: any) {
      setError(
        e.response?.data?.message || 'Order creation failed'
      );
    }
  }

  async function addStaff(e: React.FormEvent) {
    e.preventDefault();

    try {
      await call('post', '/staff', staffForm);

      setStaffForm({
        full_name: '',
        username: '',
        password: '',
        staff_type: 'delivery'
      });

      try {
        const refreshed = await call('get', '/staff');
        setStaff(Array.isArray(refreshed) ? refreshed : []);
      } catch {}

      await load();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Staff creation failed');
    }
  }

  async function addProduct(e: React.FormEvent) {
    e.preventDefault();

    try {
      await call('post', '/inventory', {
        ...productForm,
        quantity: Number(productForm.quantity),
        price: Number(productForm.price)
      });

      setProductForm({
        name: '',
        unit: 'pcs',
        quantity: '',
        price: ''
      });

      await load();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Inventory save failed');
    }
  }

  async function recordPayment(e: React.FormEvent) {
  e.preventDefault();

  if (!payOrder) return;

  const amount = Number(payAmount);
  const total = Number(payOrder.total);
  const alreadyPaid = Number(payOrder.amount_paid || 0);
  const balance = Number((total - alreadyPaid).toFixed(2));

  // Validate payment input
  if (!Number.isFinite(amount) || amount <= 0) {
    setError('Please enter a valid payment amount.');
    return;
  }

  // Prevent payment beyond remaining balance
  if (amount > balance) {
    setError(`Payment cannot exceed the remaining balance of ${fmt(balance)}.`);
    return;
  }

  try {
    setBusy(true);
    setError('');

    // Send payment to TypeScript API
    const result = await call(
      'post',
      `/orders/${payOrder.id}/payments`,
      { amount: amount }
    );

    // Refresh orders and payment information
    await load();

    // Close modal after successful payment
    setPayOrder(null);
    setPayAmount('');

    // Check if fully paid
    if (Number(result.payment?.balance) <= 0) {
      setError('Payment successful! Order is now fully PAID.');
    }

  } catch (e: any) {
    setError(
      e.response?.data?.message ||
      'Payment failed. Please try again.'
    );
  } finally {
    setBusy(false);
  }
}
  async function updateStatus(o: Order, status: string) {
    try {
      setError('');
      await call('patch', `/orders/${o.id}/status`, { status });
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Status update failed');
    }
  }

  const admin = user?.role === 'admin';
  const customer = user?.role === 'customer';
  const staffUser = user?.role === 'staff';

  const activeOrders = orders.filter(
    o => !['Delivered', 'Picked Up'].includes(o.status)
  ).length;

  const revenue = orders.reduce(
    (sum, o) => sum + Number(o.amount_paid || 0),
    0
  );

  const outstanding = orders.reduce(
    (sum, o) =>
      sum + Math.max(0, Number(o.total) - Number(o.amount_paid)),
    0
  );

  // AUTH SCREEN
  if (!user)
    return (
      <div className="auth">
        <div className="auth-left">
          <div className="brand">
            <span className="logo">
              <Droplets />
            </span>
            <div>
              <h1>
                Laundri<span>Flow</span>
              </h1>
              <small>MANAGEMENT SUITE</small>
            </div>
          </div>

          <div className="auth-visual">
            <div className="bubble"></div>
            <Shirt size={90} />
            <h2>
              Fresh clothes.
              <br />
              Smooth workflow.
            </h2>
            <p>Every load, under control.</p>
          </div>
        </div>

        <div className="auth-right">
          <div className="auth-box">
            <div className="mobile-brand">
              <Droplets /> LaundriFlow
            </div>

            <span className="eyebrow">WELCOME TO LAUNDRIFLOW</span>

            <h2>
              {mode === 'login'
                ? 'Sign in to your account'
                : mode === 'register'
                ? 'Create customer account'
                : 'Initial administrator setup'}
            </h2>

            <p className="muted">Access your laundry orders and account.</p>

            {error && <div className="error">{error}</div>}

            <form
              onSubmit={authSubmit}
              className="stack"
              autoComplete="off"
            >
              {mode !== 'login' && (
                <label>
                  Full name
                  <input
                    value={form.full_name}
                    onChange={e =>
                      setForm({ ...form, full_name: e.target.value })
                    }
                    required
                    placeholder="Your full name"
                  />
                </label>
              )}

              <label>
                Username
                <input
                  value={form.username}
                  onChange={e =>
                    setForm({ ...form, username: e.target.value })
                  }
                  required
                  placeholder="Username"
                  autoComplete="off"
                  name="lf-login-username"
                />
              </label>

              <label>
                Password
                <input
                  type="password"
                  value={form.password}
                  onChange={e =>
                    setForm({ ...form, password: e.target.value })
                  }
                  required
                  minLength={mode === 'adminsetup' ? 8 : 6}
                  placeholder="Password"
                  autoComplete="new-password"
                  name="lf-login-password"
                />
              </label>

              <button className="btn primary" disabled={busy}>
                {busy
                  ? 'Please wait...'
                  : mode === 'login'
                  ? 'Sign in'
                  : mode === 'register'
                  ? 'Register customer'
                  : 'Create admin'}
              </button>
            </form>

            <div className="auth-links">
              {mode === 'login' ? (
                <>
                  <button onClick={() => setMode('register')}>
                    Create customer account
                  </button>
                  <button onClick={() => setMode('adminsetup')}>
                    Initial admin setup
                  </button>
                </>
              ) : (
                <button onClick={() => setMode('login')}>
                  Back to login
                </button>
              )}
            </div>

            <p className="footnote">
              Admin setup can only be completed once. Staff accounts are created
              by the Admin.
            </p>
          </div>
        </div>
      </div>
    );

  // MAIN APP
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <span className="logo">
            <Droplets />
          </span>
          <div>
            <h1>
              Laundri<span>Flow</span>
            </h1>
            <small>MANAGEMENT SUITE</small>
          </div>
        </div>

        <div className="nav-label">WORKSPACE</div>

        <nav>
          {(admin
            ? [
                ['Dashboard', Home],
                ['Orders', ClipboardList],
                ['Inventory', Package],
                ['Staff', Users],
                ['Reports', ChartNoAxesCombined]
              ]
            : customer
            ? [
                ['Dashboard', Home],
                ['My Orders', ClipboardList],
                ['New Order', Plus]
              ]
            : [
                ['Dashboard', Home],
                ['Assigned Deliveries', Truck]
              ]
          ).map(([title, Icon]: any) => (
            <button
              className={page === title ? 'active' : ''}
              onClick={() => setPage(title)}
              key={title}
            >
              <Icon size={18} />
              {title}
            </button>
          ))}
        </nav>

        <div className="sidebottom">
          <div className="helper">
            <Droplets />
            <b>Keep every load moving</b>
            <p>Clean operations, clear tracking.</p>
          </div>

          <div className="profile">
            <span className="avatar">
              {(user.full_name || user.username || 'U')
                .charAt(0)
                .toUpperCase()}
            </span>

            <div>
              <b>{user.full_name}</b>
              <small>{user.role === 'staff' ? 'Delivery staff' : user.role}</small>
              {customer && <small className="code">{user.customer_code}</small>}
            </div>

            <button className="logout" onClick={logout} title="Logout">
              <LogOut />
            </button>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="top">
          <div>
            <span className="breadcrumb">Workspace / </span>
            <strong>{page}</strong>
          </div>
          <span className="connected">
            <i /> API Connected
          </span>
        </header>

        <div className="content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {admin
                  ? 'ADMIN WORKSPACE'
                  : customer
                  ? 'CUSTOMER PORTAL'
                  : 'RIDER PORTAL'}
              </span>

              <h2>
                {page === 'Dashboard'
                  ? `Hello, ${(user.full_name || user.username || 'User').split(' ')[0]} 👋`
                  : page}
              </h2>

              <p>
                {admin
                  ? 'Manage laundry operations, staff, inventory, orders, and payments.'
                  : customer
                  ? 'Place orders and follow their progress.'
                  : 'View your assigned deliveries and delivery completion.'}
              </p>
            </div>

            {customer && page === 'My Orders' && (
              <button className="btn primary" onClick={() => setPage('New Order')}>
                <Plus size={16} /> New order
              </button>
            )}
          </div>

          {error && (
            <div className="error banner">
              {error}
              <button onClick={() => setError('')}>×</button>
            </div>
          )}

          {/* ================= RIDER DASHBOARD ================= */}
          {page === 'Dashboard' && staffUser && (
            <>
              <div className="cards">
                <Stat
                  icon={Truck}
                  title="Assigned Deliveries"
                  value={orders.filter(o => o.fulfillment === 'Delivery').length}
                />

                <Stat
                  icon={Wallet}
                  title="Awaiting Payment"
                  value={
                    orders.filter(
                      o =>
                        o.fulfillment === 'Delivery' &&
                        Number(o.total) > Number(o.amount_paid)
                    ).length
                  }
                />

                <Stat
                  icon={CheckCircle}
                  title="Ready to Deliver"
                  value={
                    orders.filter(
                      o =>
                        o.fulfillment === 'Delivery' &&
                        Number(o.total) <= Number(o.amount_paid) &&
                        o.status !== 'Delivered'
                    ).length
                  }
                />

                <Stat
                  icon={CheckCircle}
                  title="Delivered"
                  value={
                    orders.filter(
                      o =>
                        o.fulfillment === 'Delivery' &&
                        o.status === 'Delivered'
                    ).length
                  }
                />
              </div>

              <Panel
                title="My Assigned Deliveries"
                subtitle="Only orders assigned to your rider account"
              >
                <OrderTable
                  orders={orders.filter(o => o.fulfillment === 'Delivery')}
                  admin={false}
                  staffUser={staffUser}
                userId={Number(user.id)}
                  onStatus={updateStatus}
                  onPay={setPayOrder}
                />
              </Panel>
            </>
          )}

          {/* ================= ADMIN / CUSTOMER DASHBOARD ================= */}
          {page === 'Dashboard' && !staffUser && (
            <>
              {admin ? (
                <div className="cards">
                  <Stat icon={ClipboardList} title="Orders" value={orders.length} />
                  <Stat
                    icon={Users}
                    title="Customers"
                    value={report?.summary?.customer_count || 0}
                  />
                  <Stat
                    icon={Wallet}
                    title="Sales"
                    value={fmt(report?.summary?.paid ?? revenue)}
                  />
                  <Stat
                    icon={Wallet}
                    title="Balance Due"
                    value={fmt(report?.summary?.balance ?? outstanding)}
                  />
                </div>
              ) : (
                <div className="cards">
                  <Stat icon={ClipboardList} title="Orders" value={orders.length} />
                  <Stat icon={Activity} title="Active Orders" value={activeOrders} />
                  <Stat icon={Wallet} title="Total Paid" value={fmt(revenue)} />
                  <Stat icon={Wallet} title="Balance Due" value={fmt(outstanding)} />
                </div>
              )}

              {admin && (
                <Panel
                  title="Staff overview"
                  subtitle="Staff accounts currently registered in LaundriFlow"
                >
                  <div className="staff-overview">
                    <div className="staff-count">
                      <strong>{staff.length}</strong>
                      <small>Total active staff</small>
                    </div>
                    <button
                      className="btn small"
                      onClick={() => setPage('Staff')}
                    >
                      Manage staff
                    </button>
                  </div>

                  {staff.length === 0 ? (
                    <div className="empty">
                      No staff accounts yet. Create a staff account in Staff
                      management and it will appear here.
                    </div>
                  ) : (
                    <div className="staffgrid">
                      {staff.map(s => (
                        <div className="staffcard" key={s.id}>
                          <div className="avatar">
                            <UserRound />
                          </div>
                          <div>
                            <b>{s.full_name}</b>
                            <small>
                              {s.staff_type === 'delivery'
                                ? 'Delivery / Rider'
                                : 'Laundry Staff'}
                            </small>
                            <small>@{s.username}</small>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>
              )}

              <Panel
                title={customer ? 'My latest orders' : 'Latest orders'}
                subtitle="Recent laundry activity"
              >
                <OrderTable
                  orders={orders.slice(0, 5)}
                  admin={admin}
                  staffUser={staffUser}
                userId={Number(user.id)}
                  onStatus={updateStatus}
                  onPay={setPayOrder}
                />
              </Panel>
            </>
          )}

          {/* ================= ORDERS ================= */}
          {(page === 'Orders' ||
            page === 'My Orders' ||
            page === 'Assigned Deliveries') && (
            <Panel
              title={
                customer
                  ? 'My Orders'
                  : admin
                  ? 'Order management'
                  : 'My assigned delivery orders'
              }
              subtitle="Track service, payment, and fulfillment status"
            >
              <OrderTable
                orders={
                  staffUser
                    ? orders.filter(o => o.fulfillment === 'Delivery')
                    : orders
                }
                admin={admin}
                staffUser={staffUser}
              userId={Number(user.id)}
                onStatus={updateStatus}
                onPay={setPayOrder}
              />
            </Panel>
          )}

          {/* ================= NEW ORDER ================= */}
          {page === 'New Order' && customer && (
            <Panel
              title="Place a laundry order"
              subtitle="Choose service, weight, and pickup or delivery"
            >
              <form onSubmit={createOrder} className="formgrid">
                <label>
                  Service
                  <select
                    value={orderForm.service}
                    onChange={e =>
                      setOrderForm({ ...orderForm, service: e.target.value })
                    }
                  >
                    {services.map(([s, r]) => (
                      <option value={s} key={s}>
                        {s} — {fmt(r)}/kg
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Weight (kg)
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={orderForm.weight}
                    onChange={e =>
                      setOrderForm({ ...orderForm, weight: e.target.value })
                    }
                    required
                  />
                </label>

                <label>
                  Fulfillment
                  <select
                    value={orderForm.fulfillment}
                    onChange={e =>
                      setOrderForm({
                        ...orderForm,
                        fulfillment: e.target.value,
                        delivery_staff_id: ''
                      })
                    }
                  >
                    <option>Pickup</option>
                    <option>Delivery</option>
                  </select>
                </label>

                {orderForm.fulfillment === 'Delivery' && (
                  <label>
                    Choose delivery staff
                    <select
                      value={orderForm.delivery_staff_id}
                      onChange={e =>
                        setOrderForm({
                          ...orderForm,
                          delivery_staff_id: e.target.value
                        })
                      }
                      required
                    >
                      <option value="">Select rider</option>
                      {staff
                        .filter(s => s.staff_type === 'delivery')
                        .map(s => (
                          <option key={s.id} value={s.id}>
                            {s.full_name}
                          </option>
                        ))}
                    </select>
                  </label>
                )}

                <div className="totalbox">
                  <span>Estimated total</span>
                  <b>
                    {fmt(
                      (services.find(s => s[0] === orderForm.service)?.[1] || 50) *
                        Number(orderForm.weight || 0)
                    )}
                  </b>
                </div>

                <button className="btn primary">
                  <Plus size={16} /> Submit order
                </button>
              </form>
            </Panel>
          )}

          {/* ================= STAFF MANAGEMENT ================= */}
          {page === 'Staff' && admin && (
            <Panel
              title="Staff management"
              subtitle="Only accounts created here can access the staff login"
            >
              <form className="formgrid compact" onSubmit={addStaff}>
                <label>
                  Staff name
                  <input
                    value={staffForm.full_name}
                    onChange={e =>
                      setStaffForm({
                        ...staffForm,
                        full_name: e.target.value
                      })
                    }
                    required
                  />
                </label>

                <label>
                  Username
                  <input
                    value={staffForm.username}
                    onChange={e =>
                      setStaffForm({
                        ...staffForm,
                        username: e.target.value
                      })
                    }
                    required
                  />
                </label>

                <label>
                  Temporary password
                  <input
                    value={staffForm.password}
                    onChange={e =>
                      setStaffForm({
                        ...staffForm,
                        password: e.target.value
                      })
                    }
                    minLength={6}
                    required
                  />
                </label>

                <label>
                  Staff type
                  <select
                    value={staffForm.staff_type}
                    onChange={e =>
                      setStaffForm({
                        ...staffForm,
                        staff_type: e.target.value
                      })
                    }
                  >
                    <option value="delivery">Delivery / Rider</option>
                    <option value="laundry">Laundry Staff</option>
                  </select>
                </label>

                <button className="btn primary">
                  <Plus size={15} /> Create staff account
                </button>
              </form>

              <div className="staffgrid">
                {staff.map(s => (
                  <div className="staffcard" key={s.id}>
                    <div className="avatar">
                      <UserRound />
                    </div>
                    <div>
                      <b>{s.full_name}</b>
                      <small>
                        {s.staff_type === 'delivery'
                          ? 'Delivery / Rider'
                          : 'Laundry Staff'}
                      </small>
                      <small>@{s.username}</small>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {/* ================= INVENTORY ================= */}
          {page === 'Inventory' && admin && (
            <Panel title="Inventory" subtitle="Track supplies and stock">
              <form className="formgrid compact" onSubmit={addProduct}>
                <label>
                  Product name
                  <input
                    value={productForm.name}
                    onChange={e =>
                      setProductForm({ ...productForm, name: e.target.value })
                    }
                    required
                  />
                </label>

                <label>
                  Unit
                  <select
                    value={productForm.unit}
                    onChange={e =>
                      setProductForm({ ...productForm, unit: e.target.value })
                    }
                  >
                    <option>pcs</option>
                    <option>kg</option>
                    <option>liters</option>
                    <option>packs</option>
                  </select>
                </label>

                <label>
                  Quantity
                  <input
                    type="number"
                    min="0"
                    value={productForm.quantity}
                    onChange={e =>
                      setProductForm({
                        ...productForm,
                        quantity: e.target.value
                      })
                    }
                    required
                  />
                </label>

                <label>
                  Price
                  <input
                    type="number"
                    min="0"
                    value={productForm.price}
                    onChange={e =>
                      setProductForm({ ...productForm, price: e.target.value })
                    }
                    required
                  />
                </label>

                <button className="btn primary">
                  <Plus size={15} /> Add stock item
                </button>
              </form>

              <table className="table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Quantity</th>
                    <th>Price</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td>
                        {p.quantity} {p.unit}
                      </td>
                      <td>{fmt(p.price)}</td>
                      <td>
                        <span
                          className={`pill ${
                            Number(p.quantity) <= 5 ? 'warn' : 'ok'
                          }`}
                        >
                          {Number(p.quantity) <= 5 ? 'Low stock' : 'In stock'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          )}

          {/* ================= REPORTS ================= */}
          {page === 'Reports' && admin && (
            <Panel title="Reports" subtitle="Sales and payment summary">
              <div className="cards">
                <Stat
                  icon={ClipboardList}
                  title="Orders"
                  value={report?.summary?.order_count || 0}
                />
                <Stat
                  icon={Wallet}
                  title="Sales"
                  value={fmt(report?.summary?.sales || 0)}
                />
                <Stat
                  icon={CheckCircle}
                  title="Payments received"
                  value={fmt(report?.summary?.paid || 0)}
                />
                <Stat
                  icon={Wallet}
                  title="Balance due"
                  value={fmt(report?.summary?.balance || 0)}
                />
              </div>

              <OrderTable
                orders={orders}
                admin={admin}
                staffUser={false}
              userId={Number(user.id)}
                onStatus={updateStatus}
                onPay={setPayOrder}
              />
            </Panel>
          )}
        </div>
      </main>

      {/* ================= PAYMENT MODAL ================= */}
      {payOrder && (
        <div className="modalback">
          <div className="modal">
            <button className="close" onClick={() => setPayOrder(null)}>
              ×
            </button>

            <h3>Record customer payment</h3>
            <p className="muted">Order {payOrder.order_code}</p>

            <div className="paydetails">
              <div>
                Total order <b>{fmt(payOrder.total)}</b>
              </div>
              <div>
                Already paid <b>{fmt(payOrder.amount_paid)}</b>
              </div>
              <div>
                Balance{' '}
                <b>
                  {fmt(Number(payOrder.total) - Number(payOrder.amount_paid))}
                </b>
              </div>
            </div>

        <form onSubmit={recordPayment} className="stack">
  <label>
    Amount received
    <input
      type="number"
      min="0.01"
      max={Number(payOrder.total) - Number(payOrder.amount_paid)}
      step="0.01"
      value={payAmount}
      onChange={(e) => setPayAmount(e.target.value)}
      required
    />
  </label>

<button
  type="button"
  className="btn primary"
  disabled={busy}
  onClick={() => recordPayment({ preventDefault: () => {} } as React.FormEvent)}
>
  {busy ? 'Processing Payment...' : 'Confirm payment'}
</button>
</form>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================
// STAT CARD
// ==========================
function Stat({
  icon: Icon,
  title,
  value
}: {
  icon: any;
  title: string;
  value: any;
}) {
  return (
    <div className="stat">
      <span className="staticon">
        <Icon size={19} />
      </span>
      <div>
        <small>{title}</small>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

// ==========================
// PANEL
// ==========================
function Panel({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle: string;
  children: any;
}) {
  return (
    <section className="panel">
      <div className="panelhead">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

// ==========================
// ORDER TABLE
// ==========================


function OrderTable({
  orders,
  admin,
  staffUser,
  userId,
  onStatus,
  onPay
}: {
  orders: Order[];
  admin: boolean;
  staffUser: boolean;
  userId: number;
  onStatus: (o: Order, s: string) => void;
  onPay: (o: Order) => void;
}) {
  return (
    <div className="tablewrap">
      <table className="table">
        <thead>
          <tr>
            <th>Order / Customer</th>
            <th>Service</th>
            <th>Weight</th>
            <th>Fulfillment</th>
            {admin && <th>Assigned staff</th>}
            <th>Total</th>
            <th>Payment</th>
            <th>Status</th>
            {(admin || staffUser) && <th>Action</th>}
          </tr>
        </thead>

        <tbody>
          {orders.map(o => {
            const due = Number(o.total) - Number(o.amount_paid);
            const fullyPaid = due <= 0;
            const isDelivery = o.fulfillment === 'Delivery';
            const isPickup = o.fulfillment === 'Pickup';

            const isDelivered = o.status === 'Delivered';
            const isPickedUp = o.status === 'Picked Up';

           const assignedToThisRider =
  staffUser && Number(o.delivery_staff_id) === Number(userId);

            return (
              <tr key={o.id}>
                <td>
                  <b className="ordercode">{o.order_code}</b>
                  <small>
                    {o.customer_code || o.customer_name || 'Customer'} ·{' '}
                    {new Date(o.created_at).toLocaleDateString()}
                  </small>
                </td>

                <td>{o.service}</td>
                <td>{o.weight} kg</td>

                <td>
                  <span className="pill">{o.fulfillment}</span>
                </td>

                {admin && (
                  <td>{o.delivery_staff_name || '—'}</td>
                )}

                <td>{fmt(o.total)}</td>

                <td>
                  <span
                    className={`pill ${
                      fullyPaid
                        ? 'ok'
                        : Number(o.amount_paid) > 0
                        ? 'warn'
                        : 'neutral'
                    }`}
                  >
                    {fullyPaid
                      ? 'Paid'
                      : Number(o.amount_paid) > 0
                      ? 'Partial'
                      : 'Unpaid'}
                  </span>

                  <small>
                    {fmt(o.amount_paid)} paid · {fmt(Math.max(0, due))} due
                  </small>
                </td>

                <td>
                  <span className="pill">{o.status}</span>
                </td>

                {(admin || staffUser) && (
                  <td>
                    {admin ? (
                      <>
                        <button
                          className="btn small"
                          disabled={fullyPaid}
                          onClick={() => onPay(o)}
                        >
                          {fullyPaid ? 'Paid' : 'Record payment'}
                        </button>

                        <select
                          className="statusselect"
                          value={o.status}
                          onChange={e => onStatus(o, e.target.value)}
                        >
                          {isPickup ? (
                            <>
                              <option value="Ready for Pickup">
                                Pick Up
                              </option>
                              <option value="Picked Up">
                                Picked Up
                              </option>
                            </>
                          ) : (
                            <>
                              <option value="For Delivery">
                                For Delivery
                              </option>
                              <option value="Delivered">
                                Delivered
                              </option>
                            </>
                          )}
                        </select>
                      </>
                    ) : staffUser && isDelivery ? (
  !assignedToThisRider ? (
    <span>Not assigned</span>
  ) : isDelivered ? (
    <span className="pill ok">Delivered ✓</span>
  ) : !fullyPaid ? (
    <button className="btn small" disabled>
      Awaiting payment
    </button>
  ) : (
    <button
      className="btn small primary"
      onClick={() => onStatus(o, 'Delivered')}
    >
      Done
    </button>
  )
                    ) : staffUser && isPickup ? (
                      isPickedUp ? (
                        <span className="pill ok">Picked Up ✓</span>
                      ) : fullyPaid ? (
                        <span className="pill ok">Pickup ready</span>
                      ) : (
                        <span>Awaiting payment</span>
                      )
                    ) : null}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      {orders.length === 0 && (
        <div className="empty">No orders yet.</div>
      )}
    </div>
  );
}
