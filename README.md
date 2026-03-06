# AV Website - AI Bootcamp with OTP & Bitrix24 Integration

This project is an AI Bootcamp landing page with phone number OTP verification using 2Factor API and CRM integration with Bitrix24 webhooks.

## Features

- ✅ Phone number OTP verification (replaces WhatsApp)
- ✅ 2Factor API integration for SMS OTP
- ✅ Modal enquiry form with custom fields
- ✅ Bitrix24 CRM webhook integration
- ✅ Real-time form validation
- ✅ Responsive design

## Prerequisites

Before you begin, ensure you have:
- Node.js (v14 or higher)
- npm or yarn
- 2Factor API account and API key
- Bitrix24 account with webhook access

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit the `.env` file with your credentials:

```env
# 2Factor API Key (Get from https://2factor.in/)
TWO_FACTOR_API_KEY=your_actual_2factor_api_key

# Bitrix24 Webhook URL
BITRIX24_WEBHOOK_URL=https://your-domain.bitrix24.com/rest/1/your_webhook_code/crm.lead.add.json

# Server Port
PORT=3000
```

### 3. Get Your 2Factor API Key

1. Sign up at [https://2factor.in/](https://2factor.in/)
2. Navigate to Dashboard > API
3. Copy your API Key
4. Paste it in the `.env` file

### 4. Set Up Bitrix24 Webhook

#### Option A: Create Inbound Webhook (Recommended)

1. Log in to your Bitrix24 account
2. Go to **CRM** > **Settings** > **Webhooks**
3. Click **Inbound webhook**
4. Enable **CRM** permissions (at least `crm` scope)
5. Copy the webhook URL (format: `https://your-domain.bitrix24.com/rest/1/webhook_code/`)
6. Paste it in `.env` file with the endpoint: `https://your-domain.bitrix24.com/rest/1/webhook_code/crm.lead.add.json`

#### Option B: Use REST API with Application

1. Go to **Applications** > **Developer resources** > **Other**
2. Create a new local or webhook application
3. Get your webhook URL from the application settings

### 5. Configure Bitrix24 Custom Fields (Optional)

If you want to map the "Quick Questions" to custom fields:

1. Go to **CRM** > **Settings** > **Custom Fields** > **Leads**
2. Create custom fields for:
   - Are you a +2 student? (List or Checkbox)
   - Are you going to be idle for 100+ days? (List or Checkbox)
   - Is AI and Agentic AI the future? (List or Checkbox)
   - Ready to master AI in 100 days? (List or Checkbox)
3. Note the field IDs (format: `UF_CRM_XXXXXXXXXX`)
4. Update the field IDs in `server.js` line 156-159:

```javascript
UF_CRM_1234567890: student, // Replace with your actual field ID
UF_CRM_1234567891: idle,
UF_CRM_1234567892: future,
UF_CRM_1234567893: ready
```

### 6. Start the Server

Development mode (with auto-restart):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

The server will start on `http://localhost:3000`

### 7. Test the Application

1. Open your browser and go to `http://localhost:3000`
2. Try the OTP flow:
   - Enter a valid Indian phone number (10 digits starting with 6-9)
   - Click "Get OTP"
   - Check your phone for the OTP SMS
   - Enter the OTP and verify
3. Test the enquiry form:
   - Click anywhere that triggers the modal (you may need to add a button to open it)
   - Fill out the form
   - Submit and check Bitrix24 CRM for the new lead

## API Endpoints

### POST /api/send-otp
Send OTP to phone number

**Request:**
```json
{
  "phone": "9876543210"
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "1234567890abc",
  "message": "OTP sent successfully"
}
```

### POST /api/verify-otp
Verify OTP

**Request:**
```json
{
  "sessionId": "1234567890abc",
  "otp": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP verified successfully"
}
```

### POST /api/submit-enquiry
Submit enquiry form and create Bitrix24 lead

**Request:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "mobile": "9876543210",
  "student": "Yes",
  "idle": "No",
  "future": "Yes",
  "ready": "Yes"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Enquiry submitted successfully",
  "leadId": 123
}
```

### GET /health
Health check endpoint

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-03-05T12:00:00.000Z",
  "sessions": 5
}
```

## How to Open the Enquiry Modal

You need to add a button that calls `openEnquiryModal()` function. For example, you can add this button in your HTML:

```html
<button onclick="openEnquiryModal()" class="btn-primary">Enquire Now</button>
```

Or update an existing button:
```html
<a href="#" onclick="event.preventDefault(); openEnquiryModal();">Learn More</a>
```

## Troubleshooting

### OTP not sending
- Check your 2Factor API key is correct
- Ensure you have sufficient credits in your 2Factor account
- Check the console logs for error messages

### Bitrix24 integration not working
- Verify your webhook URL is correct
- Check webhook permissions include CRM access
- Test the webhook URL directly using Postman or curl
- Check Bitrix24 webhook logs

### Custom fields not showing in Bitrix24
- Update the field IDs in `server.js` with your actual custom field IDs
- Or remove the custom field mapping and they will be stored in COMMENTS

## Project Structure

```
AV Website/
├── index.html          # Main HTML file with modal form
├── server.js           # Express server with API endpoints
├── package.json        # Node.js dependencies
├── .env                # Environment variables (create this)
├── .env.example        # Example environment file
└── README.md           # This file
```

## Technologies Used

- **Frontend:** HTML5, CSS3, JavaScript (Vanilla)
- **Backend:** Node.js, Express.js
- **OTP Service:** 2Factor API
- **CRM:** Bitrix24 REST API
- **HTTP Client:** Axios

## Security Notes

- Never commit `.env` file to version control
- Keep your API keys secure
- Use HTTPS in production
- Implement rate limiting for API endpoints
- Add CORS configuration if needed
- Validate all inputs on server-side

## Production Deployment

For production deployment:

1. Set `NODE_ENV=production`
2. Use a process manager like PM2:
   ```bash
   npm install -g pm2
   pm2 start server.js --name av-website
   ```
3. Use a reverse proxy like Nginx
4. Enable SSL/TLS certificates
5. Set up proper logging
6. Implement rate limiting

## Support

For issues or questions:
- Check the console logs for error messages
- Verify all environment variables are set correctly
- Test API endpoints individually using Postman

## License

ISC
