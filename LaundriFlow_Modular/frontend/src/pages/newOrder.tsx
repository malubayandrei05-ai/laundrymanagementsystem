import { useEffect, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const services = [
  { name: 'Wash, Dry & Fold', rate: 50 },
  { name: 'Wash & Dry', rate: 40 },
  { name: 'Wash Only', rate: 30 },
  { name: 'Dry Cleaning', rate: 100 },
];

export default function NewOrder() {
  const [service, setService] = useState('Wash, Dry & Fold');
  const [weight, setWeight] = useState('1');
  const [fulfillment, setFulfillment] = useState('Pickup');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selectedService = services.find(s => s.name === service);
  const total = (selectedService?.rate || 0) * Number(weight || 0);

  const getToken = () => {
    return (
      localStorage.getItem('token') ||
      localStorage.getItem('laundriflow_token') ||
      localStorage.getItem('authToken') ||
      ''
    );
  };

  const submitOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    setError('');
    setSuccess('');

    if (!Number(weight) || Number(weight) <= 0) {
      setError('Please enter a valid laundry weight.');
      return;
    }

    setLoading(true);

    try {
      const token = getToken();

      const response = await fetch(`${API_URL}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          service,
          weight: Number(weight),
          fulfillment,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Failed to submit order.');
      }

      setSuccess(data.message || 'Your order has been submitted successfully!');
      setWeight('1');

      // Redirect to My Orders after successful submission
      setTimeout(() => {
        window.location.href = '/orders';
      }, 1500);

    } catch (err: any) {
      setError(err.message || 'Unable to connect to the server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-content">
      <div className="page-heading">
        <div className="eyebrow">CUSTOMER PORTAL</div>
        <h1>New Order</h1>
        <p>Place orders and follow their progress.</p>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          {success}
        </div>
      )}

      <div className="panel">
        <div className="panel-heading">
          <h2>Place a laundry order</h2>
          <p>Choose service, weight, and pickup or delivery</p>
        </div>

        <form onSubmit={submitOrder}>
          <div className="form-grid">
            <div className="form-group">
              <label>Service</label>
              <select
                value={service}
                onChange={e => setService(e.target.value)}
              >
                {services.map(s => (
                  <option key={s.name} value={s.name}>
                    {s.name} — ₱{s.rate.toFixed(2)}/kg
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Weight (kg)</label>
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={weight}
                onChange={e => setWeight(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Fulfillment</label>
              <select
                value={fulfillment}
                onChange={e => setFulfillment(e.target.value)}
              >
                <option value="Pickup">Pickup</option>
                <option value="Delivery">Delivery</option>
              </select>
            </div>
          </div>

          <div className="order-total">
            <span>Estimated total</span>
            <strong>₱{total.toFixed(2)}</strong>
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
          >
            {loading ? 'Submitting order...' : '+ Submit order'}
          </button>
        </form>
      </div>
    </div>
  );
}