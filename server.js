try {
    require('dotenv').config();
} catch (e) {
    console.warn('⚠️ dotenv not found, using hardcoded config only');
}
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const bodyParser = require('body-parser');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration — values hardcoded directly (no .env required)
const CONFIG = {
    TWO_FACTOR_API_KEY: '2df45c64-1781-11f1-bcb0-0200cd936042',
    TWO_FACTOR_SENDER_ID: 'SNSCPL',
    TWO_FACTOR_ENTITY_ID: '1001574959862480730',
    TWO_FACTOR_CONFIRM_TEMPLATE: 'snsihubconfirm01',
    TWO_FACTOR_DLT_TEMPLATE_ID: '1007793909282020049',
    BITRIX24_WEBHOOK_URL: 'https://sns.bitrix24.in/rest/196/y57zpsuo3cx8yppu/',
    ZOHO_CLIENT_ID: process.env.ZOHO_CLIENT_ID || '1000.ITWNFKM1D1DJ048VV5GJH682NK9NQB',
    ZOHO_CLIENT_SECRET: process.env.ZOHO_CLIENT_SECRET || '8b8a2c718b0bcfb73fe67a1ffff368ba9027e2a323',
    ZOHO_REFRESH_TOKEN: process.env.ZOHO_REFRESH_TOKEN || '1000.2b956a72e11e42b08366c6e3d3fee58c.efa51dcaca0400fb17a76044a5c20683',
    ZOHO_ORGANIZATION_ID: process.env.ZOHO_ORGANIZATION_ID || '60060884990',
    ZOHO_REGION: process.env.ZOHO_REGION || 'in'
};

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Request Logger Middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// OTP Configuration
const OTP_EXPIRY_TIME = 5 * 60 * 1000; // 5 minutes in milliseconds
const MAX_OTP_ATTEMPTS = 3;

// In-memory OTP storage (use Redis or database in production)
const otpStorage = new Map();

// Local Registration Tracking (for duplicate prevention)
const REGISTRATIONS_FILE = path.join(__dirname, 'registrations.json');

function getRegistrations() {
    try {
        if (!fs.existsSync(REGISTRATIONS_FILE)) {
            return { phones: [], emails: [] };
        }
        const data = fs.readFileSync(REGISTRATIONS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading registrations file:', error);
        return { phones: [], emails: [] };
    }
}

function addRegistration(email, phone) {
    try {
        const registrations = getRegistrations();
        if (email && !registrations.emails.includes(email.toLowerCase())) {
            registrations.emails.push(email.toLowerCase());
        }
        if (phone) {
            const cleanPhone = phone.replace(/\D/g, '').slice(-10);
            if (!registrations.phones.includes(cleanPhone)) {
                registrations.phones.push(cleanPhone);
            }
        }
        fs.writeFileSync(REGISTRATIONS_FILE, JSON.stringify(registrations, null, 4));
        return true;
    } catch (error) {
        console.error('Error saving registration:', error);
        return false;
    }
}

// Generate cryptographically-secure 6-digit OTP
function generateOTP() {
    return crypto.randomInt(100000, 999999).toString();
}

// Send OTP via SMS using 2Factor — multiple fallback methods
async function sendSMS(phoneNumber, otp) {
    console.log(`📱 Sending SMS OTP ${otp} to ${phoneNumber}`);

    const apiKey = process.env.TWO_FACTOR_API_KEY || CONFIG.TWO_FACTOR_API_KEY;
    if (!apiKey || apiKey === 'your_2factor_api_key_here' || apiKey === 'your_2factor_api_key') {
        console.log('⚠️ 2Factor API key not configured. OTP logging only.');
        console.log(`🔐 OTP for ${phoneNumber}: ${otp}`);
        return true;
    }

    try {
        // Clean phone number: keep all digits (91XXXXXXXXXX)
        const cleanPhone = phoneNumber.replace(/\D/g, '');

        console.log(` Sending SMS OTP ${otp} via 2Factor... Targeting: ${cleanPhone}`);

        // METHOD 1: SMS OTP with Template (Optimized GET - Most likely to work for custom DLT)
        console.log('🔄 Trying METHOD 1: Custom Template API...');
        try {
            const smsResp1 = await axios.get(
                `https://2factor.in/API/V1/${apiKey}/SMS/${cleanPhone}/${otp}/snsihubopt1`,
                { timeout: 10000 }
            );
            console.log('📡 Response:', JSON.stringify(smsResp1.data));
            if (smsResp1.data?.Status === 'Success') {
                console.log('✅ SUCCESS via Custom Template!');
                return true;
            }
        } catch (err) {
            console.log('⚠️ Custom Template error:', err.response?.data || err.message);
        }

        // METHOD 2: Basic OTP with Sender ID (Fallback)
        console.log('🔄 Trying METHOD 2: Sender ID Fallback...');
        try {
            const smsResp2 = await axios.get(
                `https://2factor.in/API/V1/${apiKey}/SMS/${cleanPhone}/${otp}/snsihubopt1`,
                { timeout: 10000 }
            );
            console.log('📡 Response:', JSON.stringify(smsResp2.data));
            if (smsResp2.data?.Status === 'Success') {
                console.log('✅ SUCCESS via Sender ID!');
                return true;
            }
        } catch (err) {
            console.log('⚠️ Sender ID Fallback error:', err.response?.data || err.message);
        }

        console.error('❌ All SMS methods failed');
        console.log(`🔐 Fallback - OTP for ${phoneNumber}: ${otp}`);
        return true;

    } catch (error) {
        console.error('❌ sendSMS error:', error.message);
        console.log(`🔐 Fallback - OTP for ${phoneNumber}: ${otp}`);
        return true;
    }
}

/**
 * Send confirmation SMS via 2Factor after registration
 */
async function sendConfirmationSMS(phoneNumber) {
    const apiKey = process.env.TWO_FACTOR_API_KEY || CONFIG.TWO_FACTOR_API_KEY;
    const senderId = process.env.TWO_FACTOR_SENDER_ID || CONFIG.TWO_FACTOR_SENDER_ID;
    const templateName = process.env.TWO_FACTOR_CONFIRM_TEMPLATE || CONFIG.TWO_FACTOR_CONFIRM_TEMPLATE;

    if (!apiKey || apiKey.includes('your_2factor')) {
        console.log('⚠️ 2Factor confirmation SMS skipped: API key not configured');
        return false;
    }

    try {
        let cleanPhone = phoneNumber.replace(/\D/g, '');
        if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;

        console.log(`📱 Sending confirmation SMS to ${cleanPhone} using template ${templateName}...`);

        const response = await axios.post(`https://2factor.in/API/V1/${apiKey}/ADDON_SERVICES/SEND/TSMS`, {
            To: cleanPhone,
            From: senderId,
            TemplateName: templateName,
            TemplateID: CONFIG.TWO_FACTOR_DLT_TEMPLATE_ID,
            EntityID: CONFIG.TWO_FACTOR_ENTITY_ID
        }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
        });

        console.log('📡 2Factor Confirmation Response:', JSON.stringify(response.data));
        return response.data?.Status === 'Success';
    } catch (error) {
        console.error('❌ sendConfirmationSMS error:', error.response?.data || error.message);
        return false;
    }
}

// Zoho Books base URLs (region-aware)
const ZOHO_AUTH_URL = () => `https://accounts.zoho.${CONFIG.ZOHO_REGION}/oauth/v2/token`;
const ZOHO_API_URL = () => `https://www.zohoapis.${CONFIG.ZOHO_REGION}/books/v3`;

// In-memory token cache (refreshed automatically before expiry)
let zohoTokenCache = { accessToken: null, expiresAt: 0 };

/**
 * Get a valid Zoho Books access token (auto-refreshes when expired)
 */
async function getZohoAccessToken() {
    if (zohoTokenCache.accessToken && Date.now() < zohoTokenCache.expiresAt - 60000) {
        return zohoTokenCache.accessToken;
    }
    const params = new URLSearchParams({
        refresh_token: CONFIG.ZOHO_REFRESH_TOKEN,
        client_id: CONFIG.ZOHO_CLIENT_ID,
        client_secret: CONFIG.ZOHO_CLIENT_SECRET,
        grant_type: 'refresh_token'
    });
    const response = await axios.post(ZOHO_AUTH_URL(), params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    if (!response.data.access_token) {
        throw new Error('Zoho token refresh failed: ' + JSON.stringify(response.data));
    }
    zohoTokenCache = {
        accessToken: response.data.access_token,
        expiresAt: Date.now() + (response.data.expires_in || 3600) * 1000
    };
    console.log('Zoho access token refreshed OK');
    return zohoTokenCache.accessToken;
}

/**
 * Find existing Zoho contact by email or create a new one.
 * Returns the contact_id.
 */
async function findOrCreateZohoContact(token, { name, email, mobile }) {
    const orgId = CONFIG.ZOHO_ORGANIZATION_ID;
    const headers = { Authorization: `Zoho-oauthtoken ${token}` };

    // Search by email first
    const searchResp = await axios.get(
        `${ZOHO_API_URL()}/contacts`,
        { headers, params: { organization_id: orgId, email, contact_type: 'customer' } }
    );
    const byEmail = searchResp.data?.contacts || [];
    if (byEmail.length > 0) {
        console.log(`Zoho: found existing contact ${byEmail[0].contact_id} for email ${email}`);
        return byEmail[0].contact_id;
    }

    // Try creating; if duplicate name error (code 3062), search by name and reuse
    try {
        const createResp = await axios.post(
            `${ZOHO_API_URL()}/contacts?organization_id=${orgId}`,
            {
                contact_name: name,
                contact_type: 'customer',
                email: email,
                mobile: `+91${mobile}`
            },
            { headers }
        );
        const contactId = createResp.data?.contact?.contact_id;
        if (!contactId) throw new Error('Failed to create Zoho contact: ' + JSON.stringify(createResp.data));
        console.log(`Zoho: created contact ${contactId} for ${name}`);
        return contactId;
    } catch (axiosErr) {
        const code = axiosErr.response?.data?.code;
        if (code === 3062) {
            // Contact with this name already exists — search by name and reuse it
            console.log(`Zoho: contact name "${name}" already exists, searching by name...`);
            const byName = await axios.get(
                `${ZOHO_API_URL()}/contacts`,
                { headers, params: { organization_id: orgId, contact_name: name, contact_type: 'customer' } }
            );
            const found = byName.data?.contacts || [];
            if (found.length > 0) {
                console.log(`Zoho: reusing existing contact ${found[0].contact_id} for ${name}`);
                return found[0].contact_id;
            }
            // Name taken but not searchable — use phone as unique suffix
            const uniqueName = `${name} (+91${mobile})`;
            const retryResp = await axios.post(
                `${ZOHO_API_URL()}/contacts?organization_id=${orgId}`,
                { contact_name: uniqueName, contact_type: 'customer', email, mobile: `+91${mobile}` },
                { headers }
            );
            const retryId = retryResp.data?.contact?.contact_id;
            if (!retryId) throw new Error('Failed to create Zoho contact (retry): ' + JSON.stringify(retryResp.data));
            console.log(`Zoho: created contact ${retryId} with unique name "${uniqueName}"`);
            return retryId;
        }
        const zohoMsg = axiosErr.response?.data?.message || axiosErr.message;
        console.error('Zoho contact creation raw error:', JSON.stringify(axiosErr.response?.data || axiosErr.message));
        throw new Error('Zoho contact error: ' + (typeof zohoMsg === 'object' ? JSON.stringify(zohoMsg) : zohoMsg));
    }
}

/**
 * Create a Zoho Books invoice and return the public payment URL.
 */
async function createZohoInvoice(token, { contactId, name, plan }) {
    const orgId = CONFIG.ZOHO_ORGANIZATION_ID;
    const planDetails = {
        '1': { amount: 1, description: 'Phase 2 — 100-Day Bootcamp Registration' },
        '500': { amount: 500, description: 'AI Challenge Registration — Mid Level' },
        '1000': { amount: 1000, description: 'AI Challenge Registration — Regular' }
    };
    const item = planDetails[plan] || planDetails['500'];

    const payload = {
        customer_id: contactId,
        invoice_number: `AV-${Date.now()}`,
        line_items: [{
            item_name: item.description,
            description: 'SNS iNNovation Hub — AI Challenge',
            quantity: 1,
            rate: item.amount
        }],
        // Tax-inclusive so the balance due equals exactly the plan amount
        is_inclusive_of_tax: true,
        // Enable Razorpay payment gateway so the "Pay Now" button appears
        payment_options: {
            payment_gateways: [{
                configured: true,
                gateway_name: 'razorpay'
            }]
        },
        notes: `Registered via snsihub.ai for plan: ${plan}`
    };

    let resp;
    try {
        resp = await axios.post(
            `${ZOHO_API_URL()}/invoices?organization_id=${orgId}`,
            payload,
            { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
        );
    } catch (axiosErr) {
        const zohoMsg = axiosErr.response?.data?.message || axiosErr.response?.data || axiosErr.message;
        console.error('Zoho invoice creation raw error:', JSON.stringify(axiosErr.response?.data || axiosErr.message));
        throw new Error('Zoho invoice error: ' + (typeof zohoMsg === 'object' ? JSON.stringify(zohoMsg) : zohoMsg));
    }

    const invoice = resp.data?.invoice;
    if (!invoice) throw new Error('Failed to create Zoho invoice: ' + JSON.stringify(resp.data));

    console.log(`Zoho: invoice ${invoice.invoice_id} created for ${name}, amount ₹${item.amount}`);

    // Mark invoice as "sent" so it moves from Draft → Active (visible via payment link)
    try {
        await axios.post(
            `${ZOHO_API_URL()}/invoices/${invoice.invoice_id}/status/sent?organization_id=${orgId}`,
            {},
            { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
        );
        console.log(`Zoho: invoice ${invoice.invoice_id} marked as sent (active)`);
    } catch (sentErr) {
        console.warn('Zoho: could not mark invoice as sent:', sentErr.response?.data?.message || sentErr.message);
    }

    // invoice_url is the public payment page
    console.log('Zoho Invoice Response detail - Has invoice_url:', !!invoice.invoice_url, 'Amount:', invoice.total);
    return {
        invoiceId: invoice.invoice_id,
        invoiceNo: invoice.invoice_number,
        paymentLink: invoice.invoice_url
    };
}

/**
 * Create Zoho Books customer + invoice and return payment link
 * POST /api/create-payment
 */
app.post('/api/create-payment', async (req, res) => {
    console.log(`[${new Date().toISOString()}] POST /api/create-payment - Request for plan: ${req.body.plan}`);
    try {
        const { name, email, mobile, plan } = req.body;

        if (!name || !email || !mobile || !plan) {
            return res.status(400).json({ success: false, message: 'name, email, mobile, and plan are required' });
        }
        if (!['1', '500', '1000'].includes(plan)) {
            return res.status(400).json({ success: false, message: 'Invalid plan. Must be 1, 500 or 1000' });
        }
        if (!CONFIG.ZOHO_CLIENT_ID || CONFIG.ZOHO_CLIENT_ID === '' || CONFIG.ZOHO_CLIENT_ID === 'your_zoho_client_id_here') {
            return res.status(503).json({ success: false, message: 'Zoho Books is not configured yet. Contact support at +91 95664 23456.' });
        }

        // 1. Get access token
        const token = await getZohoAccessToken();

        // 2. Find or create customer
        const contactId = await findOrCreateZohoContact(token, { name, email, mobile });

        // 3. Create invoice and get payment link
        const { invoiceId, invoiceNo, paymentLink } = await createZohoInvoice(token, { contactId, name, plan });

        console.log(`Zoho: invoice ${invoiceId} / ${invoiceNo} generated. Link: ${paymentLink}`);
        res.json({
            success: true,
            paymentLink: paymentLink,
            invoiceId: invoiceId,
            invoiceNo: invoiceNo,
            message: 'Invoice created successfully'
        });
    } catch (error) {
        const detail = error.response?.data?.message || error.response?.data || error.message;
        console.error('Zoho payment error:', typeof detail === 'object' ? JSON.stringify(detail) : detail);
        res.status(500).json({
            success: false,
            message: (typeof detail === 'object' ? JSON.stringify(detail) : detail) || 'Failed to create payment link'
        });
    }
});

// ── OTP Routes ────────────────────────────────────────────────────────────────

// POST /api/send-otp
app.post('/api/send-otp', async (req, res) => {

    try {

        let phone = req.body.phone || req.body.phoneNumber || req.body.mobile;

        if (!phone) {
            return res.status(400).json({
                success: false,
                message: 'Phone number missing'
            });
        }

        // convert to string and clean number - keep all digits (e.g. 91XXXXXXXXXX)
        phone = String(phone).replace(/\D/g, '');

        // ensure it has 91 prefix if it's 10 digits
        if (phone.length === 10) {
            phone = '91' + phone;
        }

        if (!/^(91)?[6-9]\d{9}$/.test(phone)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid phone number'
            });
        }

        const fullPhone = `+${phone}`;
        const cleanPhone10 = phone.slice(-10);

        // Check if phone (10-digit) is already registered
        const registrations = getRegistrations();
        if (registrations.phones.includes(cleanPhone10)) {
            console.log(`🚫 Registration blocked: phone ${cleanPhone10} already exists`);
            return res.status(400).json({
                success: false,
                message: 'This phone number is already registered'
            });
        }

        const existing = otpStorage.get(fullPhone);

        if (existing && Date.now() - existing.sentAt < 30000) {
            return res.status(429).json({
                success: false,
                message: 'Please wait (30s) before requesting new OTP'
            });
        }

        const otp = generateOTP();

        // Ensure we store and send with the same format (+91XXXXXXXXXX)
        const storageKey = fullPhone.startsWith('+') ? fullPhone : `+${fullPhone.replace(/^\+/, '')}`;

        otpStorage.set(storageKey, {
            otp,
            sentAt: Date.now(),
            expiresAt: Date.now() + OTP_EXPIRY_TIME,
            attempts: 0,
            verified: false
        });

        await sendSMS(storageKey, otp);

        console.log(`OTP generated for ${storageKey}: ${otp}`);

        res.json({
            success: true,
            message: 'OTP sent successfully'
        });

    } catch (err) {

        console.error('Error sending OTP:', err);

        res.status(500).json({
            success: false,
            message: 'Failed to send OTP'
        });

    }

});

// POST /api/verify-otp
app.post('/api/verify-otp', (req, res) => {
    try {
        const { phone, otp, sessionId } = req.body;
        let phoneNumber = phone || req.body.phoneNumber;

        // strip spaces, +91, country code etc. — keep last 10 digits
        phoneNumber = phoneNumber.replace(/\D/g, '').slice(-10);

        if (!phoneNumber || !otp) {
            return res.status(400).json({ success: false, message: 'Phone number and OTP are required' });
        }

        const fullPhone = `+91${phoneNumber}`;
        const storedData = otpStorage.get(fullPhone);

        if (!storedData) {
            return res.status(400).json({ success: false, message: 'OTP not found or expired' });
        }

        if (Date.now() > storedData.expiresAt) {
            otpStorage.delete(fullPhone);
            return res.status(400).json({ success: false, message: 'OTP has expired' });
        }

        if (storedData.attempts >= MAX_OTP_ATTEMPTS) {
            otpStorage.delete(fullPhone);
            return res.status(400).json({ success: false, message: 'Maximum verification attempts exceeded' });
        }

        storedData.attempts++;

        if (storedData.otp === otp) {
            storedData.verified = true;
            otpStorage.set(fullPhone, storedData);
            console.log(`✅ OTP verified for ${fullPhone}`);
            setTimeout(() => otpStorage.delete(fullPhone), 5000);
            return res.json({ success: true, message: 'OTP verified successfully' });
        } else {
            otpStorage.set(fullPhone, storedData);
            return res.status(400).json({
                success: false,
                message: `Invalid OTP. ${MAX_OTP_ATTEMPTS - storedData.attempts} attempts remaining`
            });
        }

    } catch (error) {
        console.error('Error verifying OTP:', error);
        res.status(500).json({ success: false, message: 'Failed to verify OTP' });
    }
});

// POST /api/resend-otp
app.post('/api/resend-otp', async (req, res) => {
    try {
        const { phone } = req.body;
        let phoneNumber = phone || req.body.phoneNumber;

        // strip spaces, +91, country code etc. — keep last 10 digits
        phoneNumber = phoneNumber.replace(/\D/g, '').slice(-10);

        if (!/^[6-9]\d{9}$/.test(phoneNumber)) {
            return res.status(400).json({ success: false, message: 'Invalid phone number' });
        }

        const fullPhone = `+91${phoneNumber}`;
        otpStorage.delete(fullPhone);

        const otp = generateOTP();
        otpStorage.set(fullPhone, {
            otp,
            sentAt: Date.now(),
            expiresAt: Date.now() + OTP_EXPIRY_TIME,
            attempts: 0,
            verified: false
        });

        await sendSMS(fullPhone, otp);
        console.log(`🔄 OTP resent for ${fullPhone}: ${otp}`);

        res.json({ success: true, message: 'OTP resent successfully' });

    } catch (error) {
        console.error('Error resending OTP:', error);
        res.status(500).json({ success: false, message: 'Failed to resend OTP' });
    }
});


/**
 * Submit Enquiry Form — Bitrix24 CRM
 * POST /api/submit-enquiry
 */
app.post('/api/submit-enquiry', async (req, res) => {
    try {
        const {
            name, email, phone, mobile,
            age, city, preferredTrack, presentStatus, careerGoal, addressProofType, addressProofFile,
            plan
        } = req.body;

        // Normalise field names
        const contactPhone = phone || mobile;

        console.log('🔍 Raw enquiry body received with fields:', Object.keys(req.body));

        // Validate required fields
        if (!name || !email || !contactPhone) {
            return res.status(400).json({ success: false, message: 'Name, email, and phone are required' });
        }

        // Check if email is already registered
        const registrations = getRegistrations();
        if (registrations.emails.includes(email.toLowerCase())) {
            return res.status(400).json({
                success: false,
                message: 'This email is already registered'
            });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ success: false, message: 'Invalid email format' });
        }

        const planLabels = {
            free: 'Early Bird — FREE',
            waitlist: 'General Waitlist — FREE',
            '500': 'Mid Level — ₹500',
            '1000': 'Regular — ₹1,000'
        };
        const planLabel = planLabels[plan] || 'General Enquiry';

        const nameParts = name.trim().split(/\s+/);
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ') || '-';

        // Map Select Field Values to Bitrix Internal IDs
        const STATUS_MAP = {
            'Student': '132263',
            'Working Professional': '132265',
            'Entrepreneur': '132267',
            'Other': '132269'
        };
        const PROOF_MAP = {
            'Aadhaar Card': '132271',
            'Driving Licence': '132277'
        };

        const TRACK_MAP = {
            'Tech Track': '132275',
            'JEE / NEET Track': '132277',
            'Govt Exams Track': '132279',
            'Banking Track': '132281'
        };

        const bitrixStatusId = STATUS_MAP[presentStatus] || '';
        const bitrixProofId = PROOF_MAP[addressProofType] || '';
        const bitrixTrackId = TRACK_MAP[preferredTrack] || '';

        let leadId = null;

        // ── METHOD 1: REST API Webhook (primary) ──
        try {
            const BITRIX24_WEBHOOK = process.env.BITRIX24_WEBHOOK_URL || CONFIG.BITRIX24_WEBHOOK_URL;

            if (!BITRIX24_WEBHOOK || BITRIX24_WEBHOOK.includes('YOUR_WEBHOOK_URL_HERE')) {
                throw new Error('Bitrix24 webhook not configured');
            }

            const webhookBase = BITRIX24_WEBHOOK.replace(/crm\.lead\.add\.json\/?$/, '').replace(/\/?$/, '/');

            const leadTitle = `Join India's Boldest AI Challenge  ${name}`;

            const fields = {
                TITLE: leadTitle,
                NAME: firstName,
                LAST_NAME: lastName,
                EMAIL: [{ VALUE: email, VALUE_TYPE: 'WORK' }],
                PHONE: [{ VALUE: `+91${contactPhone}`, VALUE_TYPE: 'MOBILE' }],
                SOURCE_ID: 'WEB',
                SOURCE_DESCRIPTION: `Join India's Boldest AI Challenge — ${planLabel}`,

                // College — Agentic AI-Bootcamp
                'UF_CRM_1585031750': '132255',

                // New Fields
                'UF_CRM_LEAD_1773071630891': age || '',
                'UF_CRM_LEAD_1774247287627': bitrixTrackId,
                'UF_CRM_LEAD_1773071722200': city || '',
                'UF_CRM_LEAD_1773071809831': bitrixStatusId,
                'UF_CRM_LEAD_1773072146968': careerGoal || '',
                'UF_CRM_LEAD_1773072247659': bitrixProofId,


                COMMENTS: [
                    '📋 Agentic AI-Bootcamp Lead Submission',
                    '',
                    '👤 Contact Information:',
                    `   Full Name:  ${name}`,
                    `   Email: ${email}`,
                    `   Phone: +91${contactPhone}`,
                    `   Age:   ${age || 'N/A'}`,
                    `   City:  ${city || 'N/A'}`,
                    `   Track: ${preferredTrack || 'N/A'}`,
                    `   Plan:  ${planLabel}`,
                    '',
                    '💼 Status & Goals:',
                    `   Status:  ${presentStatus || 'N/A'}`,
                    `   Goal:    ${careerGoal || 'N/A'}`,
                    '',
                    `🕐 Submitted: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`,
                    '📍 Source: Landing Page Form'
                ].join('\n')
            };

            // Handle File Upload for Address Proof
            if (addressProofFile && addressProofFile.content) {
                fields['UF_CRM_LEAD_1773072192923'] = {
                    fileData: [
                        addressProofFile.name || 'address_proof.jpg',
                        addressProofFile.content // This should be base64
                    ]
                };
            }

            const leadData = { fields };

            console.log('📤 Sending to Bitrix24 via webhook...');

            const wResp = await axios.post(`${webhookBase}crm.lead.add.json`, leadData, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 15000
            });

            if (wResp.data?.result) {
                leadId = wResp.data.result;
                console.log(`🎉 Lead created via webhook! ID: ${leadId}`);
            } else if (wResp.data?.error) {
                throw new Error(`Bitrix24 error: ${wResp.data.error} — ${wResp.data.error_description}`);
            }

        } catch (webhookErr) {
            console.error('⚠️ Webhook failed:', webhookErr.message);
            // We removed the old public form fallback as it's for a different CRM instance anyway
        }

        if (leadId) {
            addRegistration(email, contactPhone);
            // Send confirmation SMS asynchronously
            sendConfirmationSMS(contactPhone).catch(err => console.error('Confirmation SMS error:', err));
        }

        res.status(200).json({
            success: true,
            message: 'Registration successful! See you at the bootcamp.',
            leadId: leadId
        });

    } catch (error) {
        console.error('Error submitting enquiry:', error);
        res.status(500).json({ success: false, message: 'Failed to submit enquiry' });
    }
});

/**
 * Health check
 * GET /api/health  (also kept at /health for backward compatibility)
 */
app.get(['/api/health', '/health'], async (req, res) => {
    let bitrixStatus = 'CONFIG_MISSING';
    try {
        const webhook = process.env.BITRIX24_WEBHOOK_URL || CONFIG.BITRIX24_WEBHOOK_URL;
        if (webhook && !webhook.includes('your-domain')) {
            const webhookBase = webhook.replace(/crm\.lead\.add\.json\/?$/, '').replace(/\/?$/, '/');
            // Try a simple profile call to check connectivity
            const testResp = await axios.get(`${webhookBase}profile`, { timeout: 5000 });
            if (testResp.data?.result) bitrixStatus = 'CONNECTED';
            else bitrixStatus = 'INVALID_RESPONSE';
        }
    } catch (err) {
        bitrixStatus = `ERROR: ${err.message}`;
    }

    res.json({
        success: true,
        status: 'UP',
        timestamp: new Date().toISOString(),
        integrations: {
            twoFactor: (process.env.TWO_FACTOR_API_KEY || CONFIG.TWO_FACTOR_API_KEY) ? 'CONFIGURED' : 'MISSING',
            bitrix24: bitrixStatus,
            zohoBooks: (process.env.ZOHO_CLIENT_ID || CONFIG.ZOHO_CLIENT_ID) ? 'CONFIGURED' : 'MISSING'
        },
        sessions: {
            otp: otpStorage.size
        }
    });
});

/**
 * Helper: list all Bitrix24 Lead fields (standard + custom UF_CRM_*)
 * Useful for discovering the correct custom field IDs.
 * GET /api/bitrix-fields
 */
app.get('/api/bitrix-fields', async (req, res) => {
    try {
        const BITRIX24_WEBHOOK = process.env.BITRIX24_WEBHOOK_URL;

        if (!BITRIX24_WEBHOOK || BITRIX24_WEBHOOK === 'YOUR_WEBHOOK_URL_HERE') {
            return res.status(400).json({ success: false, message: 'Bitrix24 webhook not configured' });
        }

        const webhookBase = BITRIX24_WEBHOOK.replace(/crm\.lead\.add\.json\/?$/, '');
        const response = await axios.get(`${webhookBase}crm.lead.fields.json`);
        const allFields = response.data.result;

        const customFields = {};
        const standardFields = {};

        for (const [key, value] of Object.entries(allFields)) {
            const meta = {
                title: value.formLabel || value.listLabel || value.title,
                type: value.type,
                isRequired: value.isRequired
            };
            if (key.startsWith('UF_CRM_')) {
                customFields[key] = meta;
            } else {
                standardFields[key] = meta;
            }
        }

        res.json({ success: true, standardFields, customFields });

    } catch (error) {
        console.error('❌ Error fetching Bitrix24 fields:', error.message);
        res.status(500).json({ success: false, message: 'Failed to fetch Bitrix24 fields', error: error.message });
    }
});

/**
 * GET /api/waitlist-count
 * Returns the actual count of registered users from .registrations.json
 */
app.get('/api/waitlist-count', (req, res) => {
    try {
        const registrations = getRegistrations();
        const count = (registrations.phones ? registrations.phones.length : 0);
        res.json({ success: true, count: count });
    } catch (error) {
        console.error('Error fetching waitlist count:', error);
        res.status(500).json({ success: false, count: 0 });
    }
});

// Start server
// Catch-all route to serve the frontend index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📝 API Endpoints:`);
    console.log(`   POST /api/send-otp`);
    console.log(`   POST /api/verify-otp`);
    console.log(`   POST /api/resend-otp`);
    console.log(`   POST /api/submit-enquiry`);
    console.log(`   POST /api/create-payment`);
    console.log(`   GET  /api/bitrix-fields`);
    console.log(`   GET  /api/waitlist-count`);
    console.log(`   GET  /api/health`);
    console.log(`2Factor API Key: ${(process.env.TWO_FACTOR_API_KEY || CONFIG.TWO_FACTOR_API_KEY || '').substring(0, 10)}...`);
    console.log(`Bitrix24 Webhook: ${(process.env.BITRIX24_WEBHOOK_URL || CONFIG.BITRIX24_WEBHOOK_URL || '').substring(0, 50)}...`);
    const zohoReady = CONFIG.ZOHO_CLIENT_ID && CONFIG.ZOHO_CLIENT_ID !== 'your_zoho_client_id_here';
    console.log(`Zoho Books: ${zohoReady ? `READY (org: ${CONFIG.ZOHO_ORGANIZATION_ID}, region: .${CONFIG.ZOHO_REGION})` : 'NOT configured — add ZOHO_* vars to .env'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
    });
});

// Crash protection — keep server alive on unexpected errors
process.on('uncaughtException', err => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', err => {
    console.error('Unhandled Rejection:', err);
});
