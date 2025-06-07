# PayLinc Frontend Integration Guide

This guide explains how to integrate PayLinc payment system with your frontend application.

## Payment Flow Overview

1. **Initialize Payment** - Get payment configuration from backend
2. **Process Payment** - Handle payment on frontend using appropriate SDK
3. **Confirm Payment** - Notify backend of payment completion
4. **Handle Success** - Update UI and redirect user

## API Endpoints for Frontend

### 1. Initialize Payment

```http
POST /payment-links/{linkId}/initialize
```

**Request Body:**

```json
{
  "customerEmail": "customer@example.com",
  "customerName": "John Doe"
}
```

**Response:**

```json
{
  "message": "Payment initialized successfully",
  "paymentData": {
    // Provider-specific data (see below)
  },
  "paymentMethod": "stripe|paystack|crypto",
  "transactionId": "txn_123456",
  "currency": "USD",
  "amount": 100.0
}
```

### 2. Confirm Payment

```http
POST /payment-links/{linkId}/confirm
```

**Request Body:**

```json
{
  "transactionId": "txn_123456",
  "paymentIntentId": "pi_xxx", // For Stripe
  "reference": "ref_xxx", // For Paystack
  "txHash": "0x123..." // For Crypto
}
```

## Frontend Implementation by Payment Method

### Stripe Integration (USD, GBP, EUR)

**1. Install Stripe SDK:**

```bash
npm install @stripe/stripe-js
```

**2. Initialize Payment:**

```javascript
const response = await fetch('/payment-links/lnk_123/initialize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    customerEmail: 'customer@example.com',
    customerName: 'John Doe',
  }),
});

const { paymentData, transactionId } = await response.json();
```

**3. Process Payment:**

```javascript
import { loadStripe } from '@stripe/stripe-js';

const stripe = await loadStripe(paymentData.publishableKey);

const { error, paymentIntent } = await stripe.confirmCardPayment(
  paymentData.clientSecret,
  {
    payment_method: {
      card: cardElement, // Your card element
      billing_details: {
        name: paymentData.customerName,
        email: paymentData.customerEmail,
      },
    },
  },
);

if (!error && paymentIntent.status === 'succeeded') {
  // Confirm payment with backend
  await fetch(`/payment-links/lnk_123/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transactionId: transactionId,
      paymentIntentId: paymentIntent.id,
    }),
  });
}
```

### Paystack Integration (NGN)

**1. Install Paystack SDK:**

```bash
npm install react-paystack
```

**2. Process Payment:**

```javascript
import { usePaystackPayment } from 'react-paystack';

const config = {
  reference: paymentData.reference,
  email: paymentData.customerEmail,
  amount: paymentData.amount, // Already in kobo
  publicKey: paymentData.publicKey,
};

const initializePayment = usePaystackPayment(config);

const onSuccess = async (reference) => {
  // Confirm payment with backend
  await fetch(`/payment-links/lnk_123/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transactionId: transactionId,
      reference: reference.reference,
    }),
  });
};

const onClose = () => {
  console.log('Payment cancelled');
};

// Trigger payment
initializePayment(onSuccess, onClose);
```

### Crypto Integration (USDC, USDT, ESPEES)

**Display Payment Information:**

```javascript
const CryptoPayment = ({ paymentData, transactionId }) => {
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    navigator.clipboard.writeText(paymentData.paymentAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="crypto-payment">
      <h3>Send {paymentData.currency} Payment</h3>

      <div className="payment-details">
        <p>
          <strong>Amount:</strong> {paymentData.amount} {paymentData.currency}
        </p>
        <p>
          <strong>Network:</strong> {paymentData.network}
        </p>

        <div className="address-section">
          <label>Payment Address:</label>
          <div className="address-input">
            <input type="text" value={paymentData.paymentAddress} readOnly />
            <button onClick={copyAddress}>{copied ? 'Copied!' : 'Copy'}</button>
          </div>
        </div>

        <div className="qr-code">
          <QRCode value={paymentData.qrCode} />
        </div>

        <div className="instructions">
          <p>{paymentData.instructions}</p>
          <p>
            <a href={paymentData.explorerUrl} target="_blank">
              View Address on Explorer
            </a>
          </p>
        </div>
      </div>

      <button onClick={checkPaymentStatus}>Check Payment Status</button>
    </div>
  );
};

const checkPaymentStatus = async () => {
  // Poll for payment confirmation
  const response = await fetch(`/payment-links/lnk_123/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transactionId: transactionId,
      // Note: For crypto, confirmation happens via webhook
    }),
  });
};
```

## Complete React Component Example

```javascript
import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { usePaystackPayment } from 'react-paystack';

const PaymentPage = ({ linkId }) => {
  const [paymentData, setPaymentData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState('pending');

  const initializePayment = async (customerData) => {
    setLoading(true);
    try {
      const response = await fetch(`/payment-links/${linkId}/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customerData),
      });

      const data = await response.json();
      setPaymentData(data);
    } catch (error) {
      console.error('Payment initialization failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const confirmPayment = async (confirmationData) => {
    try {
      const response = await fetch(`/payment-links/${linkId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId: paymentData.transactionId,
          ...confirmationData,
        }),
      });

      if (response.ok) {
        setPaymentStatus('completed');
      }
    } catch (error) {
      console.error('Payment confirmation failed:', error);
      setPaymentStatus('failed');
    }
  };

  const processStripePayment = async () => {
    const stripe = await loadStripe(paymentData.paymentData.publishableKey);

    // Implement Stripe payment flow
    // (see Stripe integration example above)
  };

  const processPaystackPayment = () => {
    // Implement Paystack payment flow
    // (see Paystack integration example above)
  };

  const renderPaymentMethod = () => {
    if (!paymentData) return null;

    switch (paymentData.paymentMethod) {
      case 'stripe':
        return <StripePaymentForm onPayment={processStripePayment} />;
      case 'paystack':
        return <PaystackPaymentButton onPayment={processPaystackPayment} />;
      case 'crypto':
        return <CryptoPayment paymentData={paymentData.paymentData} />;
      default:
        return <div>Unsupported payment method</div>;
    }
  };

  return (
    <div className="payment-page">
      {!paymentData ? (
        <CustomerForm onSubmit={initializePayment} loading={loading} />
      ) : (
        <>
          <PaymentSummary
            amount={paymentData.amount}
            currency={paymentData.currency}
          />
          {renderPaymentMethod()}
          <PaymentStatus status={paymentStatus} />
        </>
      )}
    </div>
  );
};
```

## Environment Variables

Add these to your frontend environment:

```env
# Frontend URL (for redirects)
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3001

# Payment provider keys (these should be public keys)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_...
```

## Error Handling

```javascript
const handlePaymentError = (error, paymentMethod) => {
  console.error(`${paymentMethod} payment error:`, error);

  // Display user-friendly error messages
  const errorMessages = {
    card_declined: 'Your card was declined. Please try a different card.',
    insufficient_funds:
      'Insufficient funds. Please try a different payment method.',
    expired_card: 'Your card has expired. Please use a different card.',
    network_error: 'Network error. Please check your connection and try again.',
  };

  const message =
    errorMessages[error.code] || 'Payment failed. Please try again.';
  setErrorMessage(message);
};
```

## Webhook Configuration

For production, configure webhooks:

- **Stripe**: Add webhook endpoint `https://yourdomain.com/webhooks/stripe`
- **Paystack**: Add webhook endpoint `https://yourdomain.com/webhooks/paystack`
- **Crypto**: Set up blockchain monitoring service to call `https://yourdomain.com/webhooks/crypto`

## Testing

Use these test credentials:

### Stripe Test Cards

- **Success**: 4242424242424242
- **Declined**: 4000000000000002

### Paystack Test Cards

- **Success**: 4084084084084081
- **Insufficient Funds**: 4000000000000119

### Crypto Testing

- Use testnet addresses for testing crypto payments
- Monitor testnet explorers for transaction confirmations

## Security Notes

1. **Never expose secret keys** in frontend code
2. **Always validate payments** on the backend via webhooks
3. **Implement CSRF protection** for payment endpoints
4. **Use HTTPS** in production
5. **Validate all user inputs** before sending to backend

This integration provides a secure, user-friendly payment experience across all supported currencies and payment methods.
