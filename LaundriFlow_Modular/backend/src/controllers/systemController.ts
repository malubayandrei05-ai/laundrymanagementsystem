import { pool } from '../config/db.js';
import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';

const rates = {
  'Wash, Dry & Fold': 50,
  'Wash & Dry': 40,
  'Wash Only': 30,
  'Dry Cleaning': 100
};


export async function dashboard(req: Request, res: Response) {
  try {
    const isAdmin = req.user.role === 'admin';
    const isStaff = req.user.role === 'staff';

    // ORDERS
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

    let orderParams: any[] = [];

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

    const [orders]: any = await pool.query(ordersQuery, orderParams);

    // INVENTORY
    const [products]: any = await pool.query(
      `SELECT * FROM inventory ORDER BY name`
    );

    // STAFF
    const [staff]: any = await pool.query(`
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

    // CUSTOMERS - registered customer accounts
    const [[customerCount]]: any = await pool.query(`
      SELECT COUNT(*) AS count
      FROM users
      WHERE role = 'customer'
    `);

    // SALES - actual recorded payments received
    const [[paidTotal]]: any = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM payments
    `);

    // BALANCE DUE - remaining unpaid balances
    const [[balanceTotal]]: any = await pool.query(`
      SELECT COALESCE(SUM(total - amount_paid), 0) AS total
      FROM purchase
      WHERE total > amount_paid
    `);

    // SERVICES
    const services = Object.entries(rates).map(([name, rate]) => ({
      name,
      rate
    }));

    return res.json({
      orders,
      products,
      staff,
      staffCount: staff.length,
      customers: Number(customerCount.count || 0),
      revenue: Number(paidTotal.total || 0),
      balanceDue: Number(balanceTotal.total || 0),
      services
    });

  } catch (error: any) {
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
export async function createStaff(req: Request, res: Response) {
  let conn;

  try {
    const full_name = String(req.body.full_name ?? req.body.name ?? '').trim();
    const username = String(req.body.username ?? '').trim();
    const password = String(req.body.password ?? req.body.temporary_password ?? '').trim();

    let staff_type = String(
      req.body.staff_type ?? req.body.staffType ?? 'laundry'
    ).trim().toLowerCase();

    if (staff_type.includes('delivery')) {
      staff_type = 'delivery';
    } else if (staff_type.includes('laundry') || staff_type.includes('staff')) {
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

    const [existing]: any = await conn.query(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );

    if (existing.length > 0) {
      await conn.rollback();
      return res.status(409).json({
        message: 'Username already exists.'
      });
    }

    const [userResult]: any = await conn.query(
      `INSERT INTO users
        (full_name, username, password_hash, role, active)
       VALUES (?, ?, ?, 'staff', 1)`,
      [full_name, username, password_hash]
    );

    const staffId = userResult.insertId;

    await conn.query(
      `INSERT INTO staff_profiles (user_id, staff_type)
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

  } catch (error: any) {
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
export async function listStaff(req: Request, res: Response) {
  try {
    const [staff] = (await pool.query(`
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
    `)) as any;

    return res.json(staff);
  } catch (error: any) {
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
export async function deactivateStaff(req: Request, res: Response) {
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

    const [result] = (await pool.query(
      `UPDATE users
       SET active = 0
       WHERE id = ?
       AND role = 'staff'`,
      [staffId]
    )) as any;

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: 'Staff account not found.'
      });
    }

    return res.json({
      message: 'Staff account deactivated successfully.'
    });
  } catch (error: any) {
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
export async function createOrder(req: Request, res: Response) {
  try {
    const customerId = Number(req.user.id);

    const service = String(req.body.service || '').trim();
    const weight = Number(req.body.weight);
    const fulfillment = String(req.body.fulfillment || '').trim();

    const deliveryStaffId = req.body.delivery_staff_id
      ? Number(req.body.delivery_staff_id)
      : null;

    if (!Object.prototype.hasOwnProperty.call(rates, service)) {
      return res.status(400).json({
        message: 'Invalid laundry service selected.'
      });
    }

    if (!Number.isFinite(weight) || weight <= 0) {
      return res.status(400).json({
        message: 'Weight must be greater than zero.'
      });
    }

    if (!['Pickup', 'Delivery'].includes(fulfillment)) {
      return res.status(400).json({
        message: 'Fulfillment must be Pickup or Delivery.'
      });
    }

    if (fulfillment === 'Delivery') {
      if (!deliveryStaffId || !Number.isInteger(deliveryStaffId)) {
        return res.status(400).json({
          message: 'Please select a delivery rider.'
        });
      }

      const [rider] = (await pool.query(
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
      )) as any;

      if (rider.length === 0) {
        return res.status(400).json({
          message: 'Selected rider is invalid or inactive.'
        });
      }
    }

    const assignedRider =
      fulfillment === 'Delivery'
        ? deliveryStaffId
        : null;

    const rate = rates[service as keyof typeof rates];
    const total = Number((rate * weight).toFixed(2));

    const orderCode =
      `LF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const [result] = (await pool.query(
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
    )) as any;

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
  } catch (error: any) {
    console.error('CREATE ORDER ERROR:', error);

    return res.status(500).json({
      message: 'Failed to submit order.',
      error: error.message
    });
  }
}

// =============================================
// UPDATE ORDER STATUS
// PICKUP / DELIVERY LOCK LOGIC
// =============================================
export async function updateOrder(req: Request, res: Response) {
  let conn: any;

  try {
    const orderId = Number(req.params.id);
    const requestedStatus = String(req.body.status || '').trim();

    const allowedStatuses = [
      'Received',
      'Processing',
      'Washing',
      'Drying',
      'Ironing',
      'Completed',
      'Ready for Pickup',
      'Picked Up',
      'For Delivery',
      'Delivered',
      'Cancelled'
    ];

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({
        message: 'Invalid order ID.'
      });
    }

    if (!allowedStatuses.includes(requestedStatus)) {
      return res.status(400).json({
        message: 'Invalid order status.'
      });
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [rows] = (await conn.query(
      `SELECT *
       FROM purchase
       WHERE id = ?
       FOR UPDATE`,
      [orderId]
    )) as any;

    if (!rows.length) {
      await conn.rollback();

      return res.status(404).json({
        message: 'Order not found.'
      });
    }

    const order = rows[0];

    const total = Number(order.total || 0);
    const amountPaid = Number(order.amount_paid || 0);
    const isFullyPaid = amountPaid >= total;

    const isPickup = order.fulfillment === 'Pickup';
    const isDelivery = order.fulfillment === 'Delivery';

    const isAdmin = req.user.role === 'admin';
    const isStaff = req.user.role === 'staff';

    const currentStatus = String(order.status || '');

    if (currentStatus === 'Cancelled') {
      await conn.rollback();

      return res.status(403).json({
        message: 'Cancelled orders cannot be changed.'
      });
    }

    if (isPickup && isFullyPaid) {
      if (currentStatus === 'Picked Up') {
        await conn.rollback();

        return res.status(403).json({
          message: 'This Pickup order is already picked up and locked.'
        });
      }

      if (requestedStatus !== 'Picked Up') {
        await conn.rollback();

        return res.status(403).json({
          message: 'This Pickup order is locked because it is fully paid. Only Picked Up is allowed.'
        });
      }
    }

    if (isDelivery && currentStatus === 'Delivered') {
      await conn.rollback();

      return res.status(403).json({
        message: 'This Delivery order is already delivered and locked.'
      });
    }

    if (isStaff && isDelivery) {
      if (Number(order.delivery_staff_id) !== Number(req.user.id)) {
        await conn.rollback();

        return res.status(403).json({
          message: 'You are not assigned to this delivery.'
        });
      }

      if (requestedStatus !== 'Delivered') {
        await conn.rollback();

        return res.status(403).json({
          message: 'Riders can only mark delivery orders as Delivered.'
        });
      }

      if (!isFullyPaid) {
        await conn.rollback();

        return res.status(403).json({
          message: 'Delivery cannot be completed until the order is fully paid.'
        });
      }

     // Prevent marking already delivered orders again
if (currentStatus === 'Delivered') {
  await conn.rollback();

  return res.status(403).json({
    message: 'This order has already been delivered.'
  });
}
    }

    if (
      isDelivery &&
      requestedStatus === 'For Delivery' &&
      !isFullyPaid
    ) {
      await conn.rollback();

      return res.status(403).json({
        message: 'Delivery order must be fully paid before it can be sent to the rider.'
      });
    }

    if (
      isPickup &&
      requestedStatus === 'Ready for Pickup' &&
      !isFullyPaid
    ) {
      await conn.rollback();

      return res.status(403).json({
        message: 'Pickup order must be fully paid before it can be marked Ready for Pickup.'
      });
    }

    if (isPickup && requestedStatus === 'Delivered') {
      await conn.rollback();

      return res.status(400).json({
        message: 'Pickup orders cannot be marked Delivered.'
      });
    }

    if (isDelivery && requestedStatus === 'Picked Up') {
      await conn.rollback();

      return res.status(400).json({
        message: 'Delivery orders cannot be marked Picked Up.'
      });
    }

    const [result] = (await conn.query(
      `UPDATE purchase
       SET status = ?
       WHERE id = ?`,
      [requestedStatus, orderId]
    )) as any;

    if (result.affectedRows === 0) {
      await conn.rollback();

      return res.status(404).json({
        message: 'Order not found.'
      });
    }

    await conn.commit();

    return res.json({
      message: 'Order status updated successfully.',
      order: {
        id: orderId,
        status: requestedStatus,
        fulfillment: order.fulfillment,
        total,
        amount_paid: amountPaid,
        isFullyPaid,
        isLocked:
          (isPickup && isFullyPaid) ||
          (isDelivery && requestedStatus === 'Delivered')
      }
    });
  } catch (error: any) {
    if (conn) {
      try {
        await conn.rollback();
      } catch {}
    }

    console.error('UPDATE ORDER STATUS ERROR:', error);

    return res.status(500).json({
      message: 'Failed to update order status.',
      error: error.message
    });
  } finally {
    if (conn) {
      conn.release();
    }
  }
}


// =============================================
// UPDATE INVENTORY
// =============================================
export async function updateInventory(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, unit, quantity, price } = req.body;

    const [result] = (await pool.query(
      `UPDATE inventory
       SET name = ?, unit = ?, quantity = ?, price = ?
       WHERE id = ?`,
      [name, unit, quantity, price, id]
    )) as any;

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: 'Inventory item not found.'
      });
    }

    return res.json({
      message: 'Inventory updated successfully.'
    });
  } catch (error: any) {
    console.error('Update inventory error:', error);

    return res.status(500).json({
      message: 'Failed to update inventory.',
      error: error.message
    });
  }
}

// =============================================
// STAFF ORDERS
// RIDER: GET ONLY THEIR ASSIGNED DELIVERIES
// =============================================
export async function staffOrders(req: Request, res: Response) {
  try {
    const staffId = Number(req.user.id);

    if (!staffId) {
      return res.status(401).json({
        message: 'Unauthorized rider.'
      });
    }

    const [orders] = (await pool.query(
      `SELECT
          o.*,
          u.full_name AS customer_name,
          u.customer_code,
          d.full_name AS delivery_staff_name
       FROM purchase o
       INNER JOIN users u
          ON u.id = o.customer_id
       LEFT JOIN users d
          ON d.id = o.delivery_staff_id
       WHERE o.delivery_staff_id = ?
         AND o.fulfillment = 'Delivery'
       ORDER BY o.created_at DESC`,
      [staffId]
    )) as any;

    return res.json({
      orders
    });
  } catch (error: any) {
    console.error('STAFF ORDERS ERROR:', error);

    return res.status(500).json({
      message: 'Failed to load assigned deliveries.',
      error: error.message
    });
  }
}

// =============================================
// CREATE INVENTORY ITEM
// =============================================
export async function createInventory(req: Request, res: Response) {
  try {
    const name = String(req.body?.name ?? '').trim();
    const unit = String(req.body?.unit ?? 'pcs').trim();
    const quantity = Number(req.body?.quantity);
    const price = Number(req.body?.price);

    if (!name) return res.status(400).json({ message: 'Product name is required.' });
    if (!Number.isInteger(quantity) || quantity < 0) {
      return res.status(400).json({ message: 'Quantity must be a whole number of zero or more.' });
    }
    if (!Number.isFinite(price) || price < 0) {
      return res.status(400).json({ message: 'Price must be zero or greater.' });
    }

    const [result]: any = await pool.query(
      'INSERT INTO inventory (name, unit, quantity, price) VALUES (?, ?, ?, ?)',
      [name, unit || 'pcs', quantity, price]
    );
    const [rows]: any = await pool.query('SELECT * FROM inventory WHERE id = ?', [result.insertId]);
    return res.status(201).json({ message: 'Inventory item created.', item: rows[0] });
  } catch (error: any) {
    console.error('CREATE INVENTORY ERROR:', error);
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Inventory item already exists.' });
    return res.status(500).json({ message: 'Failed to create inventory item.', error: error.message });
  }
}


// =============================================
// INVENTORY LIST
// =============================================
export async function inventoryList(req: Request, res: Response) {
  try {
    const [items] = (await pool.query(
      'SELECT * FROM inventory ORDER BY name ASC'
    )) as any;

    return res.json(items);
  } catch (error: any) {
    console.error('Inventory list error:', error);

    return res.status(500).json({
      message: 'Failed to load inventory.',
      error: error.message
    });
  }
}

// =============================================
// INVENTORY STOCK ACTIONS
// =============================================

// ADD STOCK (+1 by default)
export async function addInventoryStock(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const quantity = Number(req.body?.quantity ?? 1);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'Invalid inventory item ID.' });
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({ message: 'Quantity must be a positive whole number.' });
    }

    const [result]: any = await pool.query(
      'UPDATE inventory SET quantity = quantity + ? WHERE id = ?',
      [quantity, id]
    );

    if (result.affectedRows === 0) {
      const [existing]: any = await pool.query('SELECT id FROM inventory WHERE id = ?', [id]);
      if (!existing.length) return res.status(404).json({ message: 'Inventory item not found.' });
    }

    const [rows]: any = await pool.query('SELECT * FROM inventory WHERE id = ?', [id]);
    return res.json({ message: 'Stock added successfully.', item: rows[0] });
  } catch (error: any) {
    console.error('ADD INVENTORY STOCK ERROR:', error);
    return res.status(500).json({ message: 'Failed to add stock.', error: error.message });
  }
}


// DEDUCT STOCK (-1 by default); prevents stock from going below zero
export async function deductInventoryStock(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const quantity = Number(req.body?.quantity ?? 1);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'Invalid inventory item ID.' });
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({ message: 'Quantity must be a positive whole number.' });
    }

    const [result]: any = await pool.query(
      'UPDATE inventory SET quantity = quantity - ? WHERE id = ? AND quantity >= ?',
      [quantity, id, quantity]
    );

    if (result.affectedRows === 0) {
      const [existing]: any = await pool.query('SELECT quantity FROM inventory WHERE id = ?', [id]);
      if (!existing.length) return res.status(404).json({ message: 'Inventory item not found.' });
      return res.status(400).json({
        message: 'Insufficient stock. Stock cannot go below zero.',
        available: Number(existing[0].quantity)
      });
    }

    const [rows]: any = await pool.query('SELECT * FROM inventory WHERE id = ?', [id]);
    return res.json({ message: 'Stock deducted successfully.', item: rows[0] });
  } catch (error: any) {
    console.error('DEDUCT INVENTORY STOCK ERROR:', error);
    return res.status(500).json({ message: 'Failed to deduct stock.', error: error.message });
  }
}


// BUY: reduce stock and write purchase history in one transaction
export async function buyInventoryItem(req: Request, res: Response) {
  let conn: any;
  try {
    const id = Number(req.params.id);
    const quantity = Number(req.body?.quantity);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'Invalid inventory item ID.' });
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({ message: 'Enter a valid whole-number quantity to buy.' });
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [items]: any = await conn.query(
      'SELECT id, name, unit, quantity, price FROM inventory WHERE id = ? FOR UPDATE',
      [id]
    );

    if (!items.length) {
      await conn.rollback();
      return res.status(404).json({ message: 'Inventory item not found.' });
    }

    const item = items[0];
    const available = Number(item.quantity);
    const price = Number(item.price);

    if (available < quantity) {
      await conn.rollback();
      return res.status(400).json({
        message: `Not enough ${item.name} in stock. Available: ${available} ${item.unit}.`,
        available
      });
    }

    const totalAmount = Number((price * quantity).toFixed(2));

    await conn.query(
      'UPDATE inventory SET quantity = quantity - ? WHERE id = ? AND quantity >= ?',
      [quantity, id, quantity]
    );

    await conn.query(
      `INSERT INTO inventory_purchases
       (inventory_id, item_name, quantity, unit_price, total_amount)
       VALUES (?, ?, ?, ?, ?)`,
      [id, item.name, quantity, price, totalAmount]
    );

    await conn.commit();

    const [updatedRows]: any = await pool.query('SELECT * FROM inventory WHERE id = ?', [id]);
    return res.json({
      message: 'Purchase recorded and stock updated successfully.',
      item: updatedRows[0],
      purchase: {
        inventory_id: id,
        item_name: item.name,
        quantity,
        unit_price: price,
        total_amount: totalAmount
      }
    });
  } catch (error: any) {
    if (conn) {
      try { await conn.rollback(); } catch {}
    }
    console.error('BUY INVENTORY ERROR:', error);
    return res.status(500).json({ message: 'Purchase failed.', error: error.message });
  } finally {
    if (conn) conn.release();
  }
}


// PURCHASE DASHBOARD SUMMARY
export async function getInventorySummary(req: Request, res: Response) {
  try {
    const [rows]: any = await pool.query(`
      SELECT
        COUNT(*) AS total_purchases,
        COALESCE(SUM(quantity), 0) AS total_units,
        COALESCE(SUM(total_amount), 0) AS total_sales,
        COUNT(DISTINCT inventory_id) AS items_purchased
      FROM inventory_purchases
    `);
    const summary = rows[0] || {};
    return res.json({
      totalPurchases: Number(summary.total_purchases || 0),
      totalUnits: Number(summary.total_units || 0),
      totalSales: Number(summary.total_sales || 0),
      itemsPurchased: Number(summary.items_purchased || 0)
    });
  } catch (error: any) {
    console.error('INVENTORY SUMMARY ERROR:', error);
    return res.status(500).json({ message: 'Failed to load inventory summary.', error: error.message });
  }
}


// RECENT PURCHASE HISTORY
export async function getInventoryPurchaseHistory(req: Request, res: Response) {
  try {
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '50'), 10) || 50, 1), 100);
    const [rows]: any = await pool.query(
      `SELECT id, inventory_id, item_name, quantity, unit_price, total_amount, purchased_at
       FROM inventory_purchases
       ORDER BY purchased_at DESC, id DESC
       LIMIT ?`,
      [limit]
    );
    return res.json(rows);
  } catch (error: any) {
    console.error('INVENTORY PURCHASE HISTORY ERROR:', error);
    return res.status(500).json({ message: 'Failed to load purchase history.', error: error.message });
  }
}


// =============================================
// REPORTS
// =============================================
export async function reports(req: Request, res: Response) {
  try {
    // Order and payment summary
    const [orderStats] = await pool.query(`
      SELECT
        COUNT(*) AS order_count,
        COALESCE(SUM(total), 0) AS sales,
        COALESCE(SUM(amount_paid), 0) AS paid,
        COALESCE(SUM(GREATEST(total - amount_paid, 0)), 0) AS balance
      FROM purchase
    `) as any;

    // Registered customers count
    const [customerStats] = await pool.query(`
      SELECT COUNT(*) AS customer_count
      FROM users
      WHERE role = 'customer'
    `) as any;

    // Orders grouped by status
    const [statusStats] = await pool.query(`
      SELECT status, COUNT(*) AS count
      FROM purchase
      GROUP BY status
    `) as any;

    // Orders grouped by service
    const [serviceStats] = await pool.query(`
      SELECT
        service,
        COUNT(*) AS count,
        COALESCE(SUM(total), 0) AS revenue
      FROM purchase
      GROUP BY service
    `) as any;

    return res.json({
      summary: {
        ...orderStats[0],
        customer_count: Number(customerStats[0]?.customer_count || 0)
      },
      ordersByStatus: statusStats,
      ordersByService: serviceStats
    });

  } catch (error: any) {
    console.error('Reports error:', error);

    return res.status(500).json({
      message: 'Failed to generate reports.',
      error: error.message
    });
  }
}