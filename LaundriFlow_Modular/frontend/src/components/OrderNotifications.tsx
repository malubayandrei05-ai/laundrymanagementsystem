import React, { useEffect, useMemo, useState } from 'react';

type LaundryOrder = {
  id: number;
  order_code?: string;
  customer_name?: string;
  service?: string;
  fulfillment?: 'Pickup' | 'Delivery' | string;
  total?: number | string;
  status?: string;
  created_at?: string;
};

type Props = {
  orders: LaundryOrder[];
  onCountChange?: (count: number) => void;
  onViewOrders?: () => void;
};

export default function OrderNotifications({
  orders,
  onCountChange,
  onViewOrders,
}: Props) {
  const [open, setOpen] = useState(false);

  const newOrders = useMemo(() => {
    return orders.filter((order) => {
      const status = String(order.status ?? '').toLowerCase();
      return status === 'received' || status === 'new';
    });
  }, [orders]);

  useEffect(() => {
    onCountChange?.(newOrders.length);
  }, [newOrders.length, onCountChange]);

  const formatMoney = (amount: number | string | undefined) => {
    return `₱${Number(amount || 0).toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatTime = (date?: string) => {
    if (!date) return 'New order';

    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return 'Recently';

    const diff = Math.floor((Date.now() - parsed.getTime()) / 1000);

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;

    return parsed.toLocaleDateString();
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {/* Notification Bell */}
      <button
        onClick={() => setOpen((previous) => !previous)}
        aria-label="Order notifications"
        style={{
          position: 'relative',
          width: 48,
          height: 48,
          borderRadius: 14,
          border: '1px solid #dcebe3',
          background: '#ffffff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#075c43',
        }}
      >
        <svg
          width="23"
          height="23"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </svg>

        {newOrders.length > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -6,
              right: -6,
              minWidth: 21,
              height: 21,
              padding: '0 5px',
              borderRadius: 20,
              background: '#e53945',
              color: '#fff',
              fontSize: 11,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid white',
            }}
          >
            {newOrders.length > 99 ? '99+' : newOrders.length}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 998,
            }}
          />

          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 58,
              width: 360,
              maxWidth: 'calc(100vw - 24px)',
              background: '#ffffff',
              borderRadius: 18,
              boxShadow: '0 15px 40px rgba(0,0,0,0.15)',
              border: '1px solid #e3eee8',
              zIndex: 999,
              overflow: 'hidden',
            }}
          >
            {/* Panel Header */}
            <div
              style={{
                padding: '17px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid #edf2ef',
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 16, color: '#163f32' }}>
                New Orders
                {newOrders.length > 0 && (
                  <span
                    style={{
                      marginLeft: 8,
                      background: '#e53945',
                      color: '#fff',
                      borderRadius: 20,
                      padding: '2px 7px',
                      fontSize: 12,
                    }}
                  >
                    {newOrders.length}
                  </span>
                )}
              </div>

              <span style={{ fontSize: 12, color: '#6b8b7e' }}>
                {newOrders.length} pending
              </span>
            </div>

            {/* Orders List */}
            <div style={{ maxHeight: 380, overflowY: 'auto' }}>
              {newOrders.length === 0 ? (
                <div
                  style={{
                    padding: 35,
                    textAlign: 'center',
                    color: '#81958b',
                  }}
                >
                  <div style={{ fontSize: 30, marginBottom: 8 }}>🔔</div>
                  <strong>No new orders</strong>
                  <div style={{ fontSize: 13, marginTop: 5 }}>
                    New customer laundry orders will appear here.
                  </div>
                </div>
              ) : (
                newOrders.map((order) => (
                  <div
                    key={order.id}
                    style={{
                      display: 'flex',
                      gap: 12,
                      padding: '15px 18px',
                      borderBottom: '1px solid #edf2ef',
                    }}
                  >
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        flexShrink: 0,
                        borderRadius: 13,
                        background: '#fff0f1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 20,
                      }}
                    >
                      🧺
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 750,
                          color: '#203c31',
                          fontSize: 14,
                        }}
                      >
                        New Laundry Order
                      </div>

                      <div style={{ color: '#71847a', fontSize: 12, marginTop: 3 }}>
                        {order.order_code || `Order #${order.id}`}
                        {' · '}
                        {order.fulfillment || 'Laundry'}
                      </div>

                      <div
                        style={{
                          color: '#183f32',
                          fontWeight: 700,
                          fontSize: 13,
                          marginTop: 5,
                        }}
                      >
                        {formatMoney(order.total)}
                      </div>

                      <div style={{ color: '#92a39b', fontSize: 11, marginTop: 4 }}>
                        {formatTime(order.created_at)}
                      </div>
                    </div>

                    <span
                      style={{
                        width: 8,
                        height: 8,
                        background: '#13a05f',
                        borderRadius: '50%',
                        marginTop: 6,
                        flexShrink: 0,
                      }}
                    />
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <button
              onClick={() => {
                setOpen(false);
                onViewOrders?.();
              }}
              style={{
                width: '100%',
                padding: 16,
                border: 'none',
                borderTop: '1px solid #edf2ef',
                background: '#ffffff',
                color: '#08794f',
                fontWeight: 800,
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              View All Orders →
            </button>
          </div>
        </>
      )}
    </div>
  );
}