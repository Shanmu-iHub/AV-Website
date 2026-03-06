# Payment Gateway Integration Guide

## Current Registration Flow

1. User clicks "Register Now" (navbar) or "JOIN WAITLIST BEFORE 14TH APRIL" (hero button)
2. Modal opens with phone number input
3. User enters phone number → Receives OTP via SMS
4. User verifies OTP
5. **Registration form appears** with fields:
   - Name
   - Email
   - Quick Questions (4 checkboxes)
6. User fills form and clicks "Proceed to Payment"
7. Form data is submitted to Bitrix24 CRM
8. **User is redirected to payment gateway**

## Payment Gateway Integration Options

### Option 1: Razorpay (Recommended for India)

1. **Sign up at**: https://razorpay.com/
2. **Get API Keys**: Dashboard → Settings → API Keys

**Add to `.env` file:**
```env
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
```

**Install Razorpay package:**
```bash
npm install razorpay
```

**Update `server.js`** - Add this endpoint:
```javascript
const Razorpay = require('razorpay');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Create payment order
app.post('/api/create-payment', async (req, res) => {
    try {
        const { amount, name, email, mobile } = req.body;
        
        const options = {
            amount: amount * 100, // Razorpay expects amount in paise
            currency: 'INR',
            receipt: `receipt_${Date.now()}`,
            notes: {
                name: name,
                email: email,
                mobile: mobile
            }
        };
        
        const order = await razorpay.orders.create(options);
        
        res.json({
            success: true,
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            key: process.env.RAZORPAY_KEY_ID
        });
    } catch (error) {
        console.error('Payment creation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create payment order'
        });
    }
});

// Verify payment
app.post('/api/verify-payment', async (req, res) => {
    try {
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
        
        const crypto = require('crypto');
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(razorpay_order_id + '|' + razorpay_payment_id)
            .digest('hex');
        
        if (expectedSignature === razorpay_signature) {
            res.json({
                success: true,
                message: 'Payment verified successfully'
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Invalid payment signature'
            });
        }
    } catch (error) {
        console.error('Payment verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify payment'
        });
    }
});
```

**Update `index.html`** - Replace the payment redirect section in `submitRegistrationForm`:
```javascript
// After successful Bitrix24 submission:
if (result.success) {
    // Create payment order
    const paymentResponse = await fetch('/api/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            amount: 1000, // Amount in INR (change as needed)
            name: formData.name,
            email: formData.email,
            mobile: formData.mobile
        })
    });
    
    const paymentData = await paymentResponse.json();
    
    if (paymentData.success) {
        // Initialize Razorpay
        const options = {
            key: paymentData.key,
            amount: paymentData.amount,
            currency: paymentData.currency,
            order_id: paymentData.orderId,
            name: 'SNS iNNovation Hub',
            description: 'AI Challenge Registration Fee',
            image: 'https://snsgroups.com/sns.png',
            prefill: {
                name: formData.name,
                email: formData.email,
                contact: formData.mobile
            },
            theme: {
                color: '#f5af23'
            },
            handler: async function(response) {
                // Payment successful
                const verifyResponse = await fetch('/api/verify-payment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(response)
                });
                
                const verifyData = await verifyResponse.json();
                
                if (verifyData.success) {
                    alert('Payment successful! Welcome to the AI Challenge!');
                    closeRegisterModal();
                    showToast();
                } else {
                    alert('Payment verification failed. Please contact support.');
                }
            },
            modal: {
                ondismiss: function() {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Proceed to Payment';
                }
            }
        };
        
        const rzp = new Razorpay(options);
        rzp.open();
        closeRegisterModal();
    }
}
```

**Add Razorpay script** to `index.html` (in `<head>` section):
```html
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
```

---

### Option 2: PayU

1. **Sign up at**: https://payu.in/
2. Get Merchant Key and Salt

**Instructions**: Similar to Razorpay, use PayU SDK

---

### Option 3: Paytm

1. **Sign up at**: https://business.paytm.com/
2. Get Merchant ID and Keys

---

### Option 4: Stripe (International)

1. **Sign up at**: https://stripe.com/
2. Get API Keys
3. Use Stripe Checkout

---

## Testing Payment Integration

### Test Mode
- Use Razorpay test mode for testing
- Test cards: 4111 1111 1111 1111 (Visa)
- Any future expiry date and CVV

### Production
- Switch to live keys when ready
- Test with small amounts first
- Set up webhooks for payment status

---

## Setting Registration Amount

In `submitRegistrationForm` function (line ~2570):
```javascript
amount: 1000, // Change this to your desired amount in INR
```

## Current Placeholder

Currently, the code shows an alert and comments where payment gateway should be integrated. Search for this comment in `index.html`:
```javascript
// Example: Redirect to payment page
// window.location.href = '/payment?amount=1000&name='...
```

Replace this section with one of the payment gateway integrations above.

---

## Quick Start (Razorpay)

1. `npm install razorpay`
2. Add Razorpay keys to `.env`
3. Add Razorpay endpoints to `server.js`
4. Add Razorpay checkout script to `index.html` head
5. Update `submitRegistrationForm` with Razorpay code
6. Test with test mode keys
7. Switch to live keys for production

---

## Support

For payment gateway specific issues:
- Razorpay: https://razorpay.com/docs/
- PayU: https://devguide.payu.in/
- Paytm: https://developer.paytm.com/
- Stripe: https://stripe.com/docs/
