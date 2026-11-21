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

    let ordersQuery = `
      SELECT
        o.*,
        u.full_name AS customer_name,
        u.customer_code,
        d.full_name AS delivery_staff_name
      FROM orders o
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

    const [products] = await pool.query(
      `SELECT * FROM inventory ORDER BY name`
    );

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

    const [[customerCount]] = await pool.query(`
      SELECT COUNT(*) AS count
      FROM users
      WHERE role = 'customer'
    `);

    const [[paidTotal]] = await pool.query(`
      SELECT COALESCE(SUM(amount_paid), 0) AS total
      FROM orders
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

    // Normalize staff type
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

    // Check username
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

    // Insert into users table
    const [userResult] = await conn.query(
      `INSERT INTO users
        (full_name, username, password_hash, role, active)
       VALUES (?, ?, ?, 'staff', 1)`,
      [full_name, username, password_hash]
    );

    const staffId = userResult.insertId;

    // Insert staff profile
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

    // Calculate total using backend rates
    const rate = rates[service];
    const total = Number((rate * weight).toFixed(2));

    // Generate unique order code
    const orderCode =
      `LF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Save order to MySQL
    const [result] = await pool.query(
      `INSERT INTO purchase (
        order_code,
        customer_id,
        service,
        weight,
        total,
        amount_paid,
        fulfillment,
        status
      ) VALUES (?, ?, ?, ?, ?, 0, ?, 'Received')`,
      [
        orderCode,
        customerId,
        service,
        weight,
        total,
        fulfillment
      ]
    );

    // Response
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
// ===============================
// UPDATE ORDER STATUS
// ===============================
export async function updateOrder(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = [
      'Received',
      'Washing',
      'Drying',
      'Ironing',
      'Completed',
      'Ready for Pickup',
      'Picked Up',
      'For Delivery',
      'Delivered'
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: 'Invalid order status.'
      });
    }

    const [result] = await pool.query(
      'UPDATE orders SET status = ? WHERE id = ?',
      [status, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: 'Order not found.'
      });
    }

    return res.json({
      message: 'Order status updated successfully.',
      orderId: id,
      status
    });
  } catch (error) {
    console.error('Update order error:', error);

    return res.status(500).json({
      message: 'Failed to update order status.'
    });
  }
}


// ===============================
// ADD INVENTORY ITEM
// ===============================
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
      message: 'Failed to add inventory item.'
    });
  }
}


// ===============================
// UPDATE INVENTORY
// ===============================
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
      message: 'Failed to update inventory.'
    });
  }
}
// ===============================
// STAFF ORDERS
// ===============================
export async function staffOrders(req, res) {
  try {
    const staffId = req.user.id;

    const [orders] = await pool.query(
      `SELECT 
          o.*,
          u.full_name AS customer_name,
          u.customer_code
       FROM orders o
       JOIN users u ON o.customer_id = u.id
       WHERE o.delivery_staff_id = ?
       ORDER BY o.created_at DESC`,
      [staffId]
    );

    return res.json(orders);
  } catch (error) {
    console.error('Staff orders error:', error);

    return res.status(500).json({
      message: 'Failed to load staff orders.'
    });
  }
}
// ===============================
// INVENTORY LIST
// ===============================
export async function inventoryList(req, res) {
  try {
    const [items] = await pool.query(
      'SELECT * FROM inventory ORDER BY name ASC'
    );

    return res.json(items);
  } catch (error) {
    console.error('Inventory list error:', error);

    return res.status(500).json({
      message: 'Failed to load inventory.'
    });
  }
}


// ===============================
// REPORTS
// ===============================
export async function reports(req, res) {
  try {
    const [orderStats] = await pool.query(`
      SELECT
        COUNT(*) AS total_orders,
        COALESCE(SUM(total), 0) AS total_sales,
        COALESCE(SUM(amount_paid), 0) AS total_collected,
        COALESCE(SUM(total - amount_paid), 0) AS total_balance
      FROM orders
    `);

    const [statusStats] = await pool.query(`
      SELECT status, COUNT(*) AS count
      FROM orders
      GROUP BY status
    `);

    const [serviceStats] = await pool.query(`
      SELECT service, COUNT(*) AS count, COALESCE(SUM(total), 0) AS revenue
      FROM orders
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
      message: 'Failed to generate reports.'
    });
  }
}