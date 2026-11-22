import React, { useState } from 'react';

type Order = {
  id: number;
  order_code: string;
  customer_name?: string;
  service: string;
  weight: number;
  total: number;
  amount_paid: number;
};

type Props = {
  order: Order;
  onConfirm: (orderId: number, amount: number) => Promise<void>;
  onClose: () => void;
};

export default function AdminDashboardPayment({
  order,
  onConfirm,
  onClose,
}: Props) {
  const [amount, setAmount] = useState(
    Math.max(0, Number(order.total) - Number(order.amount_paid))
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const total = Number(order.total || 0);
  const paid = Number(order.amount_paid || 0);
  const balance = Math.max(0, total - paid);
  const remaining = Math.max(0, balance - Number(amount || 0));

  async function handleConfirm() {
    setError('');

    if (amount <= 0) {
      setError('Please enter a valid payment amount.');
      return;
    }

    if (amount > balance) {
      setError('Payment cannot exceed the remaining balance.');
      return;
    }

    try {
      setLoading(true);

      await onConfirm(order.id, amount);
    } catch (err: any) {
      setError(err?.message || 'Payment failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="payment-modal-overlay">
      <div className="payment-modal">
        <h2>Record Customer Payment</h2>

        <p>
          Order: <strong>{order.order_code}</strong>
        </p>

        <p>
          Customer: <strong>{order.customer_name || 'Customer'}</strong>
        </p>

        <hr />

        <div className="payment-summary">
          <p>
            Total Order:
            <strong> ₱{total.toFixed(2)}</strong>
          </p>

          <p>
            Already Paid:
            <strong> ₱{paid.toFixed(2)}</strong>
          </p>

          <p>
            Remaining Balance:
            <strong> ₱{balance.toFixed(2)}</strong>
          </p>
        </div>

        <label htmlFor="paymentAmount">Payment Amount (₱)</label>

        <input
          id="paymentAmount"
          type="number"
          min="0.01"
          step="0.01"
          max={balance}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          disabled={loading || balance <= 0}
        />

        <p>
          Balance after payment:
          <strong> ₱{remaining.toFixed(2)}</strong>
        </p>

        {remaining === 0 && amount > 0 && (
          <p className="payment-success">
            This payment will fully pay the order.
          </p>
        )}

        {error && (
          <p className="payment-error">{error}</p>
        )}

        <div className="payment-modal-actions">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading || balance <= 0 || amount <= 0 || amount > balance}
          >
            {loading ? 'Processing...' : 'Confirm Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}