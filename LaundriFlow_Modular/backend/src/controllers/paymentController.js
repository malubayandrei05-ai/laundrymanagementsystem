import { pool } from '../config/db.js';

export async function recordPayment(req, res) {
  let conn;

  try {
    const paymentAmount = Number(req.body.amount);
    const orderId = Number(req.params.id);

    if (!Number.isFinite(orderId) || orderId <= 0) {
      return res.status(400).json({
        message: 'Invalid order ID'
      });
    }

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({
        message: 'Invalid payment amount'
      });
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    // Lock order while payment is being processed
    const [rows] = await conn.query(
      'SELECT * FROM orders WHERE id = ? FOR UPDATE',
      [orderId]
    );

    if (!rows.length) {
      await conn.rollback();

      return res.status(404).json({
        message: 'Order not found'
      });
    }

    const order = rows[0];

    // Customer can only pay for their own order
    if (
      req.user.role === 'customer' &&
      Number(order.customer_id) !== Number(req.user.id)
    ) {
      await conn.rollback();

      return res.status(403).json({
        message: 'You can only pay for your own order'
      });
    }

    const total = Number(order.total);
    const alreadyPaid = Number(order.amount_paid || 0);
    const balance = total - alreadyPaid;

    if (balance <= 0) {
      await conn.rollback();

      return res.status(400).json({
        message: 'This order is already fully paid'
      });
    }

    if (paymentAmount > balance) {
      await conn.rollback();

      return res.status(400).json({
        message: `Payment exceeds remaining balance of ${balance.toFixed(2)}`
      });
    }

    const newAmountPaid = alreadyPaid + paymentAmount;
    const remainingBalance = total - newAmountPaid;

    // Update payment amount
    await conn.query(
      `UPDATE orders
       SET amount_paid = ?
       WHERE id = ?`,
      [newAmountPaid, orderId]
    );

    await conn.commit();

    return res.json({
      message: 'Payment successfully recorded',
      payment: {
        order_id: orderId,
        payment_amount: paymentAmount,
        total: total,
        amount_paid: newAmountPaid,
        balance: remainingBalance,
        status:
          remainingBalance <= 0
            ? 'Paid'
            : newAmountPaid > 0
              ? 'Partial'
              : 'Unpaid'
      }
    });

  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch {}
    }

    console.error('PAYMENT ERROR:', error);

    return res.status(500).json({
      message: 'Payment failed',
      error: error.message
    });

  } finally {
    if (conn) {
      conn.release();
    }
  }
}