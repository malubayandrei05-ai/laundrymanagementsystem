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
// CREATE ORDER (TEMPORARY)
// =============================================
export async function createOrder(req, res) {
  return res.status(501).json({
    message: 'Create order controller is not yet restored.'
  });
}

// =============================================
// UPDATE ORDER (TEMPORARY)
// =============================================
export async function updateOrder(req, res) {
  return res.status(501).json({
    message: 'Update order controller is not yet restored.'
  });
}

// =============================================
// INVENTORY LIST
// =============================================
export async function inventoryList(req, res) {
  try {
    const [items] = await pool.query(
      'SELECT * FROM inventory ORDER BY name'
    );

    return res.json(items);

  } catch (error) {
    console.error('INVENTORY ERROR:', error);

    return res.status(500).json({
      message: 'Failed to load inventory.',
      error: error.message
    });
  }
}

// =============================================
// ADD INVENTORY (TEMPORARY)
// =============================================
export async function addInventory(req, res) {
  return res.status(501).json({
    message: 'Add inventory controller is not yet restored.'
  });
}

// =============================================
// UPDATE INVENTORY (TEMPORARY)
// =============================================
export async function updateInventory(req, res) {
  return res.status(501).json({
    message: 'Update inventory controller is not yet restored.'
  });
}

// =============================================
// REPORTS (TEMPORARY)
// =============================================
export async function reports(req, res) {
  return res.status(501).json({
    message: 'Reports controller is not yet restored.'
  });
}

// =============================================
// STAFF ORDERS
// =============================================
export async function staffOrders(req, res) {
  try {
    const [orders] = await pool.query(`
      SELECT
        o.*,
        u.full_name AS customer_name,
        u.customer_code,
        d.full_name AS delivery_staff_name
      FROM orders o
      JOIN users u ON u.id = o.customer_id
      LEFT JOIN users d ON d.id = o.delivery_staff_id
      WHERE o.delivery_staff_id = ?
      AND o.fulfillment = 'Delivery'
      ORDER BY o.created_at DESC
    `, [req.user.id]);

    return res.json(orders);

  } catch (error) {
    console.error('STAFF ORDERS ERROR:', error);

    return res.status(500).json({
      message: 'Failed to load staff orders.',
      error: error.message
    });
  }
}