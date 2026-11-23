import { pool } from '../config/db.js';
import type { Request, Response } from 'express';

export async function recordPayment(req: Request, res: Response) {
  let conn;

  try {
    const paymentAmount = Number(req.body.amount);
    const orderId = Number(req.params.id);

    // =========================
    // VALIDATION
    // =========================
    if (!Number.isFinite(orderId) || orderId <= 0) {
      return res.status(400).json({
        message: 'Invalid order ID'
      });
    }

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({
        message: 'Payment amount must be greater than zero'
      });
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    // =========================
    // LOCK PURCHASE RECORD
    // =========================
    const [rows] = await conn.query(
      `SELECT *
       FROM purchase
       WHERE id = ?
       FOR UPDATE`,
      [orderId]
    );

    if (!rows.length) {
      await conn.rollback();

      return res.status(404).json({
        message: 'Order not found'
      });
    }

    const order = rows[0];

    // =========================
    // CUSTOMER OWNERSHIP
    // =========================
    if (
      req.user.role === 'customer' &&
      Number(order.customer_id) !== Number(req.user.id)
    ) {
      await conn.rollback();

      return res.status(403).json({
        message: 'You can only pay for your own order'
      });
    }

    // =========================
    // PAYMENT CALCULATION
    // =========================
    const total = Number(order.total);
    const alreadyPaid = Number(order.amount_paid || 0);
    const balance = Number((total - alreadyPaid).toFixed(2));

    // Already fully paid
    if (balance <= 0) {
      await conn.rollback();

      return res.status(400).json({
        message: 'This order is already fully paid',
        payment: {
          total,
          amount_paid: alreadyPaid,
          balance: 0,
          status: 'Paid'
        }
      });
    }

    // Prevent overpayment
    if (paymentAmount > balance) {
      await conn.rollback();

      return res.status(400).json({
        message: `Payment exceeds remaining balance of ₱${balance.toFixed(2)}`,
        balance
      });
    }

    // =========================
    // COMPUTE NEW PAYMENT
    // =========================
    const newAmountPaid = Number(
      (alreadyPaid + paymentAmount).toFixed(2)
    );

    const remainingBalance = Number(
      (total - newAmountPaid).toFixed(2)
    );

    let paymentStatus = 'Unpaid';

    if (newAmountPaid >= total) {
      paymentStatus = 'Paid';
    } else if (newAmountPaid > 0) {
      paymentStatus = 'Partial';
    }

    // =========================
    // UPDATE PURCHASE
    // =========================
    await conn.query(
      `UPDATE purchase
       SET amount_paid = ?
       WHERE id = ?`,
      [newAmountPaid, orderId]
    );

    // =========================
    // INSERT PAYMENT HISTORY
    // =========================
    await conn.query(
      `INSERT INTO payments
        (order_id, recorded_by, amount, note)
       VALUES (?, ?, ?, ?)`,
      [
        orderId,
        req.user.id,
        paymentAmount,
        `Payment recorded. Status: ${paymentStatus}`
      ]
    );

    // =========================
    // COMMIT
    // =========================
    await conn.commit();

    return res.json({
      message: 'Payment successfully recorded',

      payment: {
        order_id: orderId,
        payment_amount: paymentAmount,
        total: total,
        previous_paid: alreadyPaid,
        amount_paid: newAmountPaid,
        balance: remainingBalance,
        status: paymentStatus,
        isFullyPaid: remainingBalance <= 0
      }
    });

  } catch (error: any) {
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
