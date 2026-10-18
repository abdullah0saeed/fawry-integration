# FawryPay Integration Test Suite (Staging Verification)

A complete, production-ready Node.js & Express application with interactive views designed specifically to fulfill and pass all mandatory **FawryPay Integration Test Cases** required to go live.

---

## 🎯 Supported Test Cases Checklist

| Category | Test Case | Status / Integration Flow |
| :--- | :--- | :--- |
| **FawryPay Ref Number** | **Paid fawry reference number** | Generates real Fawry Reference Code via `PAYATFAWRY`. Links to [Fawry Staging Pay Order Portal](https://developer.fawrystaging.com/public/pay-order/) to mark as paid. Handled by Push/Pull. |
| **FawryPay Ref Number** | **Expired fawry reference number** | Sends short `paymentExpiry` in milliseconds in the charge request. Order transitions to `EXPIRED`. |
| **Credit Card** | **Success Credit Card Transaction** | Initiates card charge with `returnUrl`. Test Card: `4508 7500 1574 1019`, CVV: `100`, Exp: `01/39`. Verifies redirect signature. |
| **Credit Card** | **Failed Credit Card Transaction** | Initiates card charge with declined test card: `5078 0967 0005 3444`, CVV: `100`, OTP: `123456`. Order marked `FAILED`. |
| **E-Wallet** | **Paid Mobile Wallet** | Calls Fawry Mobile Wallet charge API (`MWALLET`). Staging auto-passes upon order generation (connected to staging emulator). |
| **My Fawry App** | **Paid MyFawryApp Order** | Generates My Fawry App order with QR Code and Deep Link. Staging auto-passes upon order generation. |
| **Update Order** | **Push Model (Server Notification V2)** | Implements `POST /api/fawry/webhook` with full SHA-256 `messageSignature` verification. Returns HTTP `200` with empty body. |
| **Update Order** | **Pull Model (Status Inquiry V2)** | Automated background scheduled job (`node-cron`) polling `GET /ECommerceWeb/Fawry/payments/status/v2` every 30 seconds for unexpired orders. Plus manual trigger. |

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd fawry-integration
npm install
```

### 2. Environment Configuration (`.env`)
The project includes a pre-configured `.env` file:

```ini
PORT=4000
FAWRY_MERCHANT_CODE=YOUR_MERCHANT_CODE
FAWRY_SECURE_KEY=YOUR_SECURE_KEY
FAWRY_BASE_URL=https://atfawry.fawrystaging.com
FAWRY_DEV_PORTAL_URL=https://developer.fawrystaging.com
APP_BASE_URL=http://localhost:4000
PULL_JOB_INTERVAL_SECONDS=30
ENABLE_PULL_CRON=true
```

### 3. Run the Application
```bash
npm start
# or with auto-restart on changes:
npm run dev
```

Open your browser at: **`http://localhost:4000`**

---

## 📋 How to Fulfill Each Test Case

### Test Case 1: Paid Fawry Reference Number
1. In the dashboard under **01 FawryPay Ref Number**, click **Generate Reference Number**.
2. Copy the generated Fawry reference number (e.g. `786035522`).
3. Click the direct link to the [Fawry Staging Pay Order Portal](https://developer.fawrystaging.com/public/pay-order/).
4. Enter the reference number and simulate payment.
5. The scheduled pull job or incoming webhook will automatically detect payment and update the status to **`PAID`**.

### Test Case 2: Expired Fawry Reference Number
1. Set the expiry in minutes (e.g., 2 minutes) and click **Generate Expiring Order**.
2. The server dispatches `paymentExpiry` (timestamp in ms) in the charge payload to Fawry.
3. Once the time passes, checking status via Pull or receiving Webhook marks the order **`EXPIRED`**.

### Test Case 3 & 4: Credit Card (Success & Failed)
1. Under **02 Credit Card Transaction**, click **Initiate Success Card Checkout** or **Initiate Failed Card Checkout**.
2. **Success Card**:
   - Number: `4508 7500 1574 1019`
   - CVV: `100` | Expiry: `01/39`
3. **Failed / Declined Card**:
   - Number: `5078 0967 0005 3444`
   - CVV: `100` | Expiry: `01/39` | OTP: `123456`
4. When returned back to `/payment/return`, signature and order status are verified and updated.

### Test Case 5: Paid Mobile Wallet (E-Wallet)
1. Under **03 E-Wallet**, enter customer mobile number and click **Generate E-Wallet Order**.
2. The server sends a charge request with `paymentMethod: 'MWALLET'`.
3. In Fawry Staging, generating the order passes the test because it connects to Fawry's online wallet emulator!

### Test Case 6: Paid MyFawryApp Order
1. Under **03 My Fawry App**, click **Generate MyFawry Order**.
2. Generates the order with Fawry staging deep link and QR code. Generating the order passes the MyFawryApp test.

### Test Case 7: Update the Order Status at Your System Using Push Model
1. Your public Webhook URL (via Cloudflare tunnel or ngrok):
   `https://cst-loan-certain-atlantic.trycloudflare.com/api/fawry/webhook`
2. Go to **Fawry Staging Dashboard >> Orders >> Settings => Payment Notification URL** and save this URL.
3. In the dashboard under **04 Update Order**, click **Create Order for Push Test**.
4. Pay the generated reference code at the [Fawry Staging Pay Order Portal](https://developer.fawrystaging.com/public/pay-order/).
5. Fawry automatically fires an HTTP POST notification (`Server Notification V2`) to your webhook URL.
6. The server:
   - Computes expected SHA-256 `messageSignature`: `SHA256(fawryRefNumber + merchantRefNumber + paymentAmount + orderAmount + orderStatus + paymentMethod + paymentRefNumber + secureKey)`
   - Matches and updates internal order status to **`PAID`** via source `WEBHOOK_PUSH`.
   - Responds with HTTP `200` and an empty body as mandated by Fawry.
7. You can also click **Dispatch Signed Push Notification** in the dashboard to test the webhook verification end-to-end at any time.
8. Inspect all received webhooks under **Webhooks** in the navigation bar.

### Test Case 8: Update Order (Pull Model Scheduled Job)
1. The background job runs automatically every 30 seconds (configurable via `PULL_JOB_INTERVAL_SECONDS`).
2. Retrieves newly created and active, non-expired orders.
3. Queries Fawry API:
   ```http
   GET /ECommerceWeb/Fawry/payments/status/v2?merchantCode=...&merchantRefNumber=...&signature=...
   ```
4. Updates internal order status and records the history entry.
5. You can also trigger an immediate pull at any time by clicking **Run Pull Job Now**.

---

## 📁 Project Architecture

```
fawry-integration/
├── .env                  # Live merchant credentials & config
├── .env.example          # Template placeholders
├── package.json          # Dependencies & scripts
├── server.js             # Express app & background cron initialization
├── data/
│   ├── orders.json       # Persistent orders database
│   └── webhooks.json     # Webhook logs database
├── routes/
│   ├── indexRoutes.js    # Dashboard, orders inspection, return callback
│   ├── paymentRoutes.js  # Charge requests for all test cases
│   └── webhookRoutes.js  # Fawry Server Notification V2 (Webhook)
├── services/
│   ├── fawryService.js   # Fawry APIs, SHA-256 signature generators & verifiers
│   ├── orderStore.js     # Storage manager for orders & webhooks
│   └── pullJob.js        # Scheduled polling job (node-cron)
├── views/
│   ├── index.ejs         # Main Test Cases Hub
│   ├── order-details.ejs # Single order inspection & timeline
│   ├── return.ejs        # Hosted card return page
│   ├── webhooks.ejs      # Server Notification V2 Inspector
│   └── config.ejs        # Credentials & setup guide
└── public/
    ├── css/style.css     # Modern fintech dark-mode stylesheet
    └── js/main.js        # Interactive client controller & modals
```
