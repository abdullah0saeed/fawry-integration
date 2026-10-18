const express = require('express');
const router = express.Router();
const fawryService = require('../services/fawryService');
const orderStore = require('../services/orderStore');
const pullJob = require('../services/pullJob');

/**
 * Generate a unique merchantRefNum
 */
function generateMerchantRefNum(prefix = 'REF') {
  return `${prefix}_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
}

/**
 * TEST CASE 1: Paid Fawry Reference Number
 * 1- Generate Fawry pay reference number using PAYATFAWRY
 * 2- Pay the reference number at https://developer.fawrystaging.com/public/pay-order/
 * 3- Handle "Update Order" test case (Push / Pull)
 */
router.post('/create-fawry-ref', async (req, res) => {
  const { amount = '100.00', mobile = '01000000000', email = 'customer@domain.com' } = req.body;
  const merchantRefNum = generateMerchantRefNum('FWRY');

  // Call Fawry Staging API
  const fawryResponse = await fawryService.createChargeRequest({
    merchantRefNum,
    paymentMethod: 'PAYATFAWRY',
    amount,
    customerMobile: mobile,
    customerEmail: email,
    description: 'Test Case 1: Paid Fawry Ref Number'
  });

  let fawryRefNumber = null;
  let orderStatus = 'NEW';

  if (fawryResponse.success && fawryResponse.data) {
    // Fawry response returns fawryRefNumber or referenceNumber
    fawryRefNumber = fawryResponse.data.fawryRefNumber || fawryResponse.data.referenceNumber || fawryResponse.data;
    if (typeof fawryRefNumber === 'object') {
      fawryRefNumber = fawryRefNumber.fawryRefNumber || fawryRefNumber.referenceNumber;
    }
    orderStatus = 'UNPAID';
  } else if (!fawryService.isConfigured()) {
    // Demo mode: provide simulated reference number if credentials are placeholders
    fawryRefNumber = '999' + Math.floor(100000 + Math.random() * 900000);
    orderStatus = 'UNPAID';
  }

  const order = orderStore.createOrder({
    merchantRefNum,
    fawryRefNumber: fawryRefNumber ? String(fawryRefNumber) : null,
    testCase: 'Paid fawry reference number',
    paymentMethod: 'PAYATFAWRY',
    amount,
    customerMobile: mobile,
    customerEmail: email,
    orderStatus,
    rawResponse: fawryResponse
  });

  return res.json({
    success: true,
    order,
    fawryRefNumber,
    payPortalUrl: 'https://developer.fawrystaging.com/public/pay-order/',
    fawryResponse
  });
});

/**
 * TEST CASE 2: Expired Fawry Reference Number
 * 1- Generate Fawry pay reference number with short expiry
 * 2- Send paymentExpiry timestamp or configure short expiry
 * 3- Handle "Update Order" test case
 */
router.post('/create-expired-ref', async (req, res) => {
  const { amount = '100.00', expiryMinutes = 2, mobile = '01000000000', email = 'customer@domain.com' } = req.body;
  const merchantRefNum = generateMerchantRefNum('EXP');

  // Set expiry timestamp (e.g. 2 minutes from now, or configurable)
  const expiryTimestamp = Date.now() + Number(expiryMinutes) * 60 * 1000;

  const fawryResponse = await fawryService.createChargeRequest({
    merchantRefNum,
    paymentMethod: 'PAYATFAWRY',
    amount,
    customerMobile: mobile,
    customerEmail: email,
    paymentExpiry: expiryTimestamp,
    description: 'Test Case 2: Expired Fawry Ref Number'
  });

  let fawryRefNumber = null;
  let orderStatus = 'NEW';

  if (fawryResponse.success && fawryResponse.data) {
    fawryRefNumber = fawryResponse.data.fawryRefNumber || fawryResponse.data.referenceNumber || fawryResponse.data;
    if (typeof fawryRefNumber === 'object') {
      fawryRefNumber = fawryRefNumber.fawryRefNumber || fawryRefNumber.referenceNumber;
    }
    orderStatus = 'UNPAID';
  } else if (!fawryService.isConfigured()) {
    fawryRefNumber = '998' + Math.floor(100000 + Math.random() * 900000);
    orderStatus = 'UNPAID';
  }

  const order = orderStore.createOrder({
    merchantRefNum,
    fawryRefNumber: fawryRefNumber ? String(fawryRefNumber) : null,
    testCase: 'Expired fawry reference number',
    paymentMethod: 'PAYATFAWRY',
    amount,
    customerMobile: mobile,
    customerEmail: email,
    orderStatus,
    paymentExpiry: expiryTimestamp,
    rawResponse: fawryResponse
  });

  return res.json({
    success: true,
    order,
    fawryRefNumber,
    expiryTimestamp,
    expiryMinutes,
    payPortalUrl: 'https://developer.fawrystaging.com/public/pay-order/',
    fawryResponse
  });
});

/**
 * TEST CASE 3 & 4: Credit Card Transaction (Success / Failed)
 * 1- Generate checkout session / charge request with returnUrl
 * 2- Redirect or open payment modal with test cards
 * 3- Handle returnUrl parameters & signature
 */
router.post('/create-card', async (req, res) => {
  const { amount = '150.00', mobile = '01000000000', email = 'customer@domain.com', scenario = 'SUCCESS' } = req.body;
  const merchantRefNum = generateMerchantRefNum(scenario === 'SUCCESS' ? 'CC_SUCC' : 'CC_FAIL');
  const returnUrl = `${fawryService.appBaseUrl}/payment/return`;

  // Call Fawry Payments Init API for hosted/plugin checkout
  const initResult = await fawryService.initCheckoutLink({
    merchantRefNum,
    amount,
    customerMobile: mobile,
    customerEmail: email,
    returnUrl,
    description: `Test Case: Credit Card ${scenario}`
  });

  const order = orderStore.createOrder({
    merchantRefNum,
    fawryRefNumber: null,
    testCase: scenario === 'SUCCESS' ? 'Success Credit Card Transaction' : 'Failed Credit Card Transaction',
    paymentMethod: 'CARD',
    amount,
    customerMobile: mobile,
    customerEmail: email,
    orderStatus: 'NEW',
    rawResponse: initResult
  });

  return res.json({
    success: true,
    order,
    paymentUrl: initResult.paymentUrl,
    checkoutPayload: initResult.requestPayload,
    signatureDebug: initResult.signatureDebug,
    fawryResponse: initResult
  });
});

/**
 * TEST CASE 5: Paid Mobile Wallet (E-Wallet: QR Code or R2P)
 * 1- Generate E-Wallet Order (QR Code or R2P)
 * 2- Automatically passed in Fawry staging emulator
 */
router.post('/create-wallet', async (req, res) => {
  const { amount = '75.00', mobile = '01012345678', email = 'wallet@domain.com' } = req.body;
  const merchantRefNum = generateMerchantRefNum('EWAL');

  const fawryResponse = await fawryService.createChargeRequest({
    merchantRefNum,
    paymentMethod: 'MWALLET',
    amount,
    customerMobile: mobile,
    customerEmail: email,
    description: 'Test Case 5: Paid Mobile Wallet'
  });

  let fawryRefNumber = null;
  let qrCode = null;
  let orderStatus = 'NEW';

  if (fawryResponse.success && fawryResponse.data) {
    fawryRefNumber = fawryResponse.data.fawryRefNumber || fawryResponse.data.referenceNumber;
    qrCode = fawryResponse.data.qrCode || fawryResponse.data.walletQrCode || null;
    orderStatus = 'UNPAID';
  } else if (!fawryService.isConfigured()) {
    fawryRefNumber = '997' + Math.floor(100000 + Math.random() * 900000);
    orderStatus = 'PAID'; // Staging auto-passes
  }

  const order = orderStore.createOrder({
    merchantRefNum,
    fawryRefNumber: fawryRefNumber ? String(fawryRefNumber) : null,
    testCase: 'Paid Mobile Wallet',
    paymentMethod: 'MWALLET',
    amount,
    customerMobile: mobile,
    customerEmail: email,
    orderStatus,
    rawResponse: fawryResponse
  });

  return res.json({
    success: true,
    order,
    fawryRefNumber,
    qrCode,
    fawryResponse
  });
});

/**
 * TEST CASE 6: Paid MyFawryApp Order
 * 1- Generate My Fawry App checkout Order
 * 2- Once succeeded to generate order, passed in Fawry staging
 */
router.post('/create-myfawry', async (req, res) => {
  const { amount = '120.00', mobile = '01000000000', email = 'myfawry@domain.com' } = req.body;
  const merchantRefNum = generateMerchantRefNum('MYF');

  const fawryResponse = await fawryService.createChargeRequest({
    merchantRefNum,
    paymentMethod: 'MYFAWRY',
    amount,
    customerMobile: mobile,
    customerEmail: email,
    description: 'Test Case 6: Paid MyFawryApp Order'
  });

  let fawryRefNumber = null;
  let orderStatus = 'NEW';

  if (fawryResponse.success && fawryResponse.data) {
    fawryRefNumber = fawryResponse.data.fawryRefNumber || fawryResponse.data.referenceNumber;
    orderStatus = 'UNPAID';
  } else if (!fawryService.isConfigured()) {
    fawryRefNumber = '996' + Math.floor(100000 + Math.random() * 900000);
    orderStatus = 'PAID'; // Staging passes upon order generation
  }

  const order = orderStore.createOrder({
    merchantRefNum,
    fawryRefNumber: fawryRefNumber ? String(fawryRefNumber) : null,
    testCase: 'Paid MyFawryApp Order',
    paymentMethod: 'MYFAWRY',
    amount,
    customerMobile: mobile,
    customerEmail: email,
    orderStatus,
    rawResponse: fawryResponse
  });

  return res.json({
    success: true,
    order,
    fawryRefNumber,
    fawryResponse
  });
});

/**
 * PULL MODEL: Inquire payment status on-demand for an order
 * Calls /ECommerceWeb/Fawry/payments/status/v2
 */
router.get('/status/:merchantRefNum', async (req, res) => {
  const { merchantRefNum } = req.params;
  const order = orderStore.getOrder(merchantRefNum);

  if (!order) {
    return res.status(404).json({ success: false, error: 'Order not found' });
  }

  const fawryStatus = await fawryService.getPaymentStatus(merchantRefNum);
  const now = Date.now();
  const isExpiredLocally = order.paymentExpiry && Number(order.paymentExpiry) <= now;

  if (fawryStatus.success && fawryStatus.data) {
    let newStatus = fawryStatus.data.paymentStatus || fawryStatus.data.orderStatus;
    const fawryRefNumber = fawryStatus.data.fawryRefNumber;

    if (isExpiredLocally && newStatus !== 'PAID') {
      newStatus = 'EXPIRED';
    }

    if (newStatus) {
      orderStore.updateOrderStatus(merchantRefNum, newStatus, 'PULL_MANUAL_API', {
        fawryRefNumber,
        lastInquiryResponse: fawryStatus.data
      });
    }
  } else if (isExpiredLocally && order.orderStatus !== 'PAID') {
    orderStore.updateOrderStatus(merchantRefNum, 'EXPIRED', 'PULL_MANUAL_EXPIRY', {
      note: 'Payment expiration window passed'
    });
  }

  const updatedOrder = orderStore.getOrder(merchantRefNum);
  return res.json({
    success: true,
    order: updatedOrder,
    fawryStatus
  });
});

/**
 * PULL MODEL: Trigger scheduled job manually
 */
router.post('/pull/trigger', async (req, res) => {
  const result = await pullJob.runJob('MANUAL_BUTTON');
  return res.json(result);
});

/**
 * PUSH MODEL TEST CASE: Update order status at your system using push model
 * Steps:
 * 1- Generate Fawry pay reference number tagged with "Update the order status at your system using push model"
 * 2- Provide reference number to pay at https://developer.fawrystaging.com/public/pay-order/
 * 3- When paid, Fawry server sends Server Notification V2 (Webhook) to your system
 */
router.post('/create-push-order', async (req, res) => {
  const { amount = '100.00', mobile = '01012345678', email = 'push-test@domain.com' } = req.body;
  const merchantRefNum = generateMerchantRefNum('PUSH');

  const fawryResponse = await fawryService.createChargeRequest({
    merchantRefNum,
    paymentMethod: 'PAYATFAWRY',
    amount,
    customerMobile: mobile,
    customerEmail: email,
    description: 'Test Case: Update order status using push model'
  });

  let fawryRefNumber = null;
  let orderStatus = 'NEW';

  if (fawryResponse.success && fawryResponse.data) {
    fawryRefNumber = fawryResponse.data.fawryRefNumber || fawryResponse.data.referenceNumber || fawryResponse.data;
    if (typeof fawryRefNumber === 'object') {
      fawryRefNumber = fawryRefNumber.fawryRefNumber || fawryRefNumber.referenceNumber;
    }
    orderStatus = 'UNPAID';
  }

  const order = orderStore.createOrder({
    merchantRefNum,
    fawryRefNumber: fawryRefNumber ? String(fawryRefNumber) : null,
    testCase: 'Update the order status at your system using push model',
    paymentMethod: 'PAYATFAWRY',
    amount,
    customerMobile: mobile,
    customerEmail: email,
    orderStatus,
    rawResponse: fawryResponse
  });

  return res.json({
    success: true,
    order,
    fawryRefNumber,
    payPortalUrl: 'https://developer.fawrystaging.com/public/pay-order/',
    webhookEndpoint: `${fawryService.appBaseUrl}/api/fawry/webhook`,
    fawryResponse
  });
});

/**
 * PUSH MODEL: Dispatch a real, valid SHA-256 Server Notification V2 payload
 * to verify the webhook pipeline locally or on public endpoint
 */
router.post('/dispatch-push-test', async (req, res) => {
  const axios = require('axios');
  const { merchantRefNum } = req.body;
  const orders = orderStore.getOrders();
  const order = merchantRefNum
    ? orderStore.getOrder(merchantRefNum)
    : orders.find(o => o.testCase.includes('push model') || o.testCase.includes('Paid fawry'));

  if (!order) {
    return res.status(404).json({ success: false, error: 'No order found to dispatch push notification for.' });
  }

  const fawryRefNumber = order.fawryRefNumber || ('7860' + Math.floor(10000 + Math.random() * 90000));
  const paymentAmount = Number(order.amount).toFixed(2);
  const orderAmount = Number(order.amount).toFixed(2);
  const orderStatus = 'PAID';
  const paymentMethod = order.paymentMethod || 'PAYATFAWRY';
  const paymentRefNumber = '1288' + Math.floor(10000000 + Math.random() * 90000000);

  const rawString = `${fawryRefNumber}${order.merchantRefNum}${paymentAmount}${orderAmount}${orderStatus}${paymentMethod}${paymentRefNumber}${fawryService.secureKey}`;
  const messageSignature = fawryService.hashSHA256(rawString);

  const payload = {
    requestId: 'req_push_' + Date.now(),
    fawryRefNumber,
    merchantRefNumber: order.merchantRefNum,
    customerMobile: order.customerMobile,
    customerMail: order.customerEmail,
    paymentAmount: Number(paymentAmount),
    orderAmount: Number(orderAmount),
    fawryFees: 0,
    shippingFees: 0,
    orderStatus,
    paymentMethod,
    paymentRefNumber,
    messageSignature,
    orderExpiryDate: Date.now() + 86400000,
    orderItems: [{
      itemCode: 'item_1',
      price: paymentAmount,
      quantity: 1
    }]
  };

  try {
    const webhookRes = await axios.post(`${fawryService.appBaseUrl}/api/fawry/webhook`, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000
    });

    const updatedOrder = orderStore.getOrder(order.merchantRefNum);
    return res.json({
      success: true,
      message: `Dispatched signed Server Notification V2 for #${order.merchantRefNum}. Webhook response: ${webhookRes.status}`,
      payload,
      order: updatedOrder
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: `Failed to dispatch webhook: ${err.message}`
    });
  }
});

module.exports = router;

