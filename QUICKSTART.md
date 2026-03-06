# Quick Start Guide

## Get Started in 5 Minutes

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Create Environment File
Copy `.env.example` to `.env`:
```bash
copy .env.example .env
```

### Step 3: Configure Your API Keys

Edit `.env` file and add your credentials:

#### Get 2Factor API Key:
1. Visit https://2factor.in/
2. Sign up for free (you get free credits)
3. Go to Dashboard → API
4. Copy your API Key
5. Paste in `.env` file: `TWO_FACTOR_API_KEY=your_key_here`

#### Get Bitrix24 Webhook URL:
1. Log in to Bitrix24
2. Go to CRM → Settings → Webhooks → Inbound webhook
3. Enable CRM permissions
4. Copy the webhook URL
5. Add to `.env` file: `BITRIX24_WEBHOOK_URL=https://your-domain.bitrix24.com/rest/1/code/crm.lead.add.json`

### Step 4: Start the Server
```bash
npm start
```

### Step 5: Open in Browser
Navigate to: http://localhost:3000

## Test the Features

### Test OTP Flow:
1. Enter a 10-digit Indian mobile number (starts with 6-9)
2. Click "Get OTP"
3. Check your phone for SMS
4. Enter the 6-digit OTP
5. Click "Verify & Join Waitlist"

### Test Enquiry Form:
1. Click "Fill out enquiry form" link
2. Fill in Name, Email, Mobile
3. Select checkboxes for quick questions
4. Click "Submit Enquiry!!!"
5. Check Bitrix24 CRM for new lead

## Troubleshooting

**OTP Not Received?**
- Check if you have credits in 2Factor account
- Verify API key is correct
- Check console logs for errors

**Bitrix24 Not Working?**
- Test webhook URL in browser or Postman
- Verify webhook permissions include CRM
- Check if custom field IDs match (or comment them out in server.js)

**Server Not Starting?**
- Make sure Node.js is installed: `node --version`
- Check if port 3000 is available
- Look for errors in the terminal

## What's Included

✅ Phone number OTP verification (2Factor API)  
✅ Modal enquiry form with custom fields  
✅ Bitrix24 CRM integration via webhook  
✅ Real-time form validation  
✅ Responsive design  

## Need Help?

Check the full README.md for detailed documentation.
