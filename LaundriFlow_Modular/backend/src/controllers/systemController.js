import { pool } from '../config/db.js';
import bcrypt from 'bcryptjs';

const rates = {
  'Wash, Dry & Fold': 50,
  'Wash & Dry': 40,
  'Wash Only': 30,
  'Dry Cleaning': 100
};

// =============================================
// DASHBOARD
// =============================================
export async function dashboard(req, res) {
  try {
    const isAdmin = req.user.role === 'admin';
    const isStaff = req.user.role === 'staff';

    // ORDERS: use purchase table
    let ordersQuery = `
      SELECT
        o.*,
        u.full_name AS customer_name,
        u.customer_code,
        d.full_name AS delivery_staff_name
      FROM purchase o
      JOIN users u ON u.id = o.customer_id
      LEFT JOIN users d ON d.id = o.delivery_staff_id
    `;

    let orderParams = [];

    if (isStaff) {
      ordersQuery += `
        WHERE o.delivery_staff_id = ?
        AND o.fulfillment = 'Delivery'
      `;
      orderParams = [req.user.id];
    } else if (!isAdmin) {
      ordersQuery += ` WHERE o.customer_id = ? `;
      orderParams = [req.user.id];
    }

    ordersQuery += ` ORDER BY o.created_at DESC`;

    const [orders] = await pool.query(ordersQuery, orderParams);

    // INVENTORY
    const [products] = await pool.query(
      `SELECT * FROM inventory ORDER BY name`
    );

    // STAFF
    const [staff] = await pool.query(`
      SELECT
        u.id,
        u.full_name,
        u.username,
        sp.staff_type
      FROM users u
      INNER JOIN staff_profiles sp ON sp.user_id = u.id
      WHERE u.active = 1
      ORDER BY u.full_name ASC
    `);

    // CUSTOMERS
    const [[customerCount]] = await pool.query(`
      SELECT COUNT(*) AS count
      FROM users
      WHERE role = 'customer'
    `);

    // REVENUE: purchase table
    const [[paidTotal]] = await pool.query(`
      SELECT COALESCE(SUM(amount_paid), 0) AS total
      FROM purchase
    `);

    const services = Object.entries(rates).map(([name, rate]) => ({
      name,
      rate
    }));

    return res.json({
      orders,
      products,
      staff,
      staffCount: staff.length,
      customers: customerCount.count,
      revenue: paidTotal.total,
      services
    });

  } catch (error) {
    console.error('DASHBOARD ERROR:', error);

    return res.status(500).json({
      message: 'Dashboard load failed',
      error: error.message
    });
  }
}

// =============================================
// CREATE STAFF
// =============================================
export async function createStaff(req, res) {
  let conn;

  try {
    const full_name = String(
      req.body.full_name ?? req.body.name ?? ''
    ).trim();

    const username = String(
      req.body.username ?? ''
    ).trim();

    const password = String(
      req.body.password ?? req.body.temporary_password ?? ''
    ).trim();

    let staff_type = String(
      req.body.staff_type ?? req.body.staffType ?? 'laundry'
    ).trim().toLowerCase();

   if (staff_type.includes('delivery')) {
  staff_type = 'delivery';
} else if (
  staff_type.includes('laundry') ||
  staff_type.includes('staff')
) {
  staff_type = 'laundry';
}

    if (!full_name || !username || !password) {
      return res.status(400).json({
        message: 'Staff name, username, and password are required.'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: 'Password must be at least 6 characters.'
      });
    }

    if (!['delivery', 'laundry'].includes(staff_type)) {
      return res.status(400).json({
        message: 'Invalid staff type.'
      });
    }

    const password_hash = await bcrypt.hash(password, 10);

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [existing] = await conn.query(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );

    if (existing.length > 0) {
      await conn.rollback();

      return res.status(409).json({
        message: 'Username already exists.'
      });
    }

    const [userResult] = await conn.query(
      `INSERT INTO users
        (full_name, username, password_hash, role, active)
       VALUES (?, ?, ?, 'staff', 1)`,
      [full_name, username, password_hash]
    );

    const staffId = userResult.insertId;

    await conn.query(
      `INSERT INTO staff_profiles
        (user_id, staff_type)
       VALUES (?, ?)`,
      [staffId, staff_type]
    );

    await conn.commit();

    return res.status(201).json({
      message: 'Staff account created successfully.',
      staff: {
        id: staffId,
        full_name,
        username,
        role: 'staff',
        staff_type,
        active: 1
      }
    });

  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch {}
    }

    console.error('CREATE STAFF ERROR:', error);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        message: 'Username already exists.'
      });
    }

    return res.status(500).json({
      message: 'Failed to create staff account.',
      error: error.message
    });

  } finally {
    if (conn) {
      conn.release();
    }
  }
}

// =============================================
// LIST STAFF
// =============================================
export async function listStaff(req, res) {
  try {
    const [staff] = await pool.query(`
      SELECT
        u.id,
        u.full_name,
        u.username,
        u.role,
        u.active,
        u.created_at,
        sp.staff_type
      FROM users u
      INNER JOIN staff_profiles sp
        ON sp.user_id = u.id
      WHERE u.role = 'staff'
      ORDER BY u.created_at DESC
    `);

    return res.json(staff);

  } catch (error) {
    console.error('LIST STAFF ERROR:', error);

    return res.status(500).json({
      message: 'Failed to load staff list.',
      error: error.message
    });
  }
}

// =============================================
// DEACTIVATE STAFF
// =============================================
export async function deactivateStaff(req, res) {
  try {
    const staffId = Number(req.params.id);

    if (!Number.isInteger(staffId) || staffId <= 0) {
      return res.status(400).json({
        message: 'Invalid staff ID.'
      });
    }

    if (Number(req.user.id) === staffId) {
      return res.status(400).json({
        message: 'You cannot deactivate your own account.'
      });
    }

    const [result] = await pool.query(
      `UPDATE users
       SET active = 0
       WHERE id = ?
       AND role = 'staff'`,
      [staffId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: 'Staff account not found.'
      });
    }

    return res.json({
      message: 'Staff account deactivated successfully.'
    });

  } catch (error) {
    console.error('DEACTIVATE STAFF ERROR:', error);

    return res.status(500).json({
      message: 'Failed to deactivate staff account.',
      error: error.message
    });
  }
}

// =============================================
// CREATE ORDER
// =============================================
export async function createOrder(req, res) {
  try {
    const customerId = Number(req.user.id);

    const service = String(req.body.service || '').trim();
    const weight = Number(req.body.weight);
    const fulfillment = String(req.body.fulfillment || '').trim();

    // Rider selected by customer
    const deliveryStaffId = req.body.delivery_staff_id
      ? Number(req.body.delivery_staff_id)
      : null;

    // Validate service
    if (!Object.prototype.hasOwnProperty.call(rates, service)) {
      return res.status(400).json({
        message: 'Invalid laundry service selected.'
      });
    }

    // Validate weight
    if (!Number.isFinite(weight) || weight <= 0) {
      return res.status(400).json({
        message: 'Weight must be greater than zero.'
      });
    }

    // Validate fulfillment
    if (!['Pickup', 'Delivery'].includes(fulfillment)) {
      return res.status(400).json({
        message: 'Fulfillment must be Pickup or Delivery.'
      });
    }

    // =============================================
    // VALIDATE SELECTED DELIVERY RIDER
    // =============================================
    if (fulfillment === 'Delivery') {
      if (!deliveryStaffId || !Number.isInteger(deliveryStaffId)) {
        return res.status(400).json({
          message: 'Please select a delivery rider.'
        });
      }

      const [rider] = await pool.query(
        `SELECT
            u.id,
            u.full_name
         FROM users u
         INNER JOIN staff_profiles sp
            ON sp.user_id = u.id
         WHERE u.id = ?
           AND u.role = 'staff'
           AND u.active = 1
           AND sp.staff_type = 'delivery'
         LIMIT 1`,
        [deliveryStaffId]
      );

      if (rider.length === 0) {
        return res.status(400).json({
          message: 'Selected rider is invalid or inactive.'
        });
      }
    }

    // Pickup does not need a rider
    const assignedRider =
      fulfillment === 'Delivery'
        ? deliveryStaffId
        : null;

    // =============================================
    // COMPUTE TOTAL
    // =============================================
    const rate = rates[service];
    const total = Number((rate * weight).toFixed(2));

    const orderCode =
      `LF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // =============================================
    // SAVE ORDER INCLUDING DELIVERY STAFF ID
    // =============================================
    const [result] = await pool.query(
      `INSERT INTO purchase (
          order_code,
          customer_id,
          service,
          weight,
          total,
          amount_paid,
          fulfillment,
          delivery_staff_id,
          status
       )
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, 'Received')`,
      [
        orderCode,
        customerId,
        service,
        weight,
        total,
        fulfillment,
        assignedRider
      ]
    );

    // =============================================
    // RESPONSE
    // =============================================
    return res.status(201).json({
      message: 'Order submitted successfully!',
      order: {
        id: result.insertId,
        order_code: orderCode,
        customer_id: customerId,
        service,
        weight,
        rate,
        total,
        amount_paid: 0,
        balance: total,
        fulfillment,
        delivery_staff_id: assignedRider,
        status: 'Received'
      }
    });

  } catch (error) {
    console.error('CREATE ORDER ERROR:', error);

    return res.status(500).json({
      message: 'Failed to submit order.',
      error: error.message
    });
  }
}
// =============================================
// UPDATE ORDER STATUS
// =============================================
export async function updateOrder(req, res) {
  try {
    const orderId = Number(req.params.id);
    const status = String(req.body.status || '').trim();

    const allowedStatuses = [
      'Received',
      'Processing',
      'Ready',
      'Completed',
      'Cancelled'
    ];

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({
        message: 'Invalid order ID.'
      });
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: 'Invalid order status.'
      });
    }

    const [result] = await pool.query(
      `UPDATE purchase
       SET status = ?
       WHERE id = ?`,
      [status, orderId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: 'Order not found.'
      });
    }

    return res.json({
      message: 'Order status updated successfully.',
      order: {
        id: orderId,
        status
      }
    });

  } catch (error) {
    console.error('UPDATE ORDER STATUS ERROR:', error);

    return res.status(500).json({
      message: 'Failed to update order status.',
      error: error.message
    });
  }
}

// =============================================
// ADD INVENTORY ITEM
// =============================================
export async function addInventory(req, res) {
  try {
    const { name, unit, quantity, price } = req.body;

    if (!name || quantity === undefined || price === undefined) {
      return res.status(400).json({
        message: 'Name, quantity, and price are required.'
      });
    }

    const [result] = await pool.query(
      `INSERT INTO inventory (name, unit, quantity, price)
       VALUES (?, ?, ?, ?)`,
      [name, unit || 'pcs', quantity, price]
    );

    return res.status(201).json({
      message: 'Inventory item added successfully.',
      id: result.insertId
    });

  } catch (error) {
    console.error('Add inventory error:', error);

    return res.status(500).json({
      message: 'Failed to add inventory item.',
      error: error.message
    });
  }
}

// =============================================
// UPDATE INVENTORY
// =============================================
export async function updateInventory(req, res) {
  try {
    const { id } = req.params;
    const { name, unit, quantity, price } = req.body;

    const [result] = await pool.query(
      `UPDATE inventory
       SET name = ?, unit = ?, quantity = ?, price = ?
       WHERE id = ?`,
      [name, unit, quantity, price, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: 'Inventory item not found.'
      });
    }

    return res.json({
      message: 'Inventory updated successfully.'
    });

  } catch (error) {
    console.error('Update inventory error:', error);

    return res.status(500).json({
      message: 'Failed to update inventory.',
      error: error.message
    });
  }
}

// =============================================
// STAFF ORDERS
// =============================================
export async function staffOrders(req, res) {
  try {
    const staffId = req.user.id;

    const [orders] = await pool.query(
      `SELECT
        o.*,
        u.full_name AS customer_name,
        u.customer_code
       FROM purchase o
       JOIN users u ON o.customer_id = u.id
       WHERE o.delivery_staff_id = ?
       AND o.fulfillment = 'Delivery'
       ORDER BY o.created_at DESC`,
      [staffId]
    );

    return res.json(orders);

  } catch (error) {
    console.error('Staff orders error:', error);

    return res.status(500).json({
      message: 'Failed to load staff orders.',
      error: error.message
    });
  }
}

// =============================================
// INVENTORY LIST
// =============================================
export async function inventoryList(req, res) {
  try {
    const [items] = await pool.query(
      'SELECT * FROM inventory ORDER BY name ASC'
    );

    return res.json(items);

  } catch (error) {
    console.error('Inventory list error:', error);

    return res.status(500).json({
      message: 'Failed to load inventory.',
      error: error.message
    });
  }
}

// =============================================
// REPORTS
// =============================================
export async function reports(req, res) {
  try {
    const [orderStats] = await pool.query(`
      SELECT
        COUNT(*) AS total_orders,
        COALESCE(SUM(total), 0) AS total_sales,
        COALESCE(SUM(amount_paid), 0) AS total_collected,
        COALESCE(SUM(total - amount_paid), 0) AS total_balance
      FROM purchase
    `);

    const [statusStats] = await pool.query(`
      SELECT status, COUNT(*) AS count
      FROM purchase
      GROUP BY status
    `);

    const [serviceStats] = await pool.query(`
      SELECT
        service,
        COUNT(*) AS count,
        COALESCE(SUM(total), 0) AS revenue
      FROM purchase
      GROUP BY service
    `);

    return res.json({
      summary: orderStats[0],
      ordersByStatus: statusStats,
      ordersByService: serviceStats
    });

  } catch (error) {
    console.error('Reports error:', error);

    return res.status(500).json({
      message: 'Failed to generate reports.',
      error: error.message
    });
  }
}
const confirmPayment = async (orderId, amount) => {
  try {
    const token =
      localStorage.getItem('token') ||
      localStorage.getItem('laundriflow_token') ||
      localStorage.getItem('authToken');

    const response = await fetch(
      `http://localhost:4000/api/orders/${orderId}/payments`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: Number(amount),
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Payment failed');
    }

    alert(
      data.payment.balance <= 0
        ? 'Payment successful! Order is now fully PAID.'
        : `Payment recorded! Remaining balance: ₱${Number(
            data.payment.balance
          ).toFixed(2)}`
    );

    // Close payment modal
    setPaymentModal(null);

    // Refresh dashboard/order list
    await loadDashboard();

  } catch (error) {
    console.error('CONFIRM PAYMENT ERROR:', error);
    alert(error.message || 'Failed to confirm payment.');
  }
};