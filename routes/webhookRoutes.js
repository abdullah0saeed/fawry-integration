const express = require('express');
const router = express.Router();
const fawryService = require('../services/fawryService');
const orderStore = require('../services/orderStore');

/**
 * Fawry Server Notification V2 (Webhook / Push Model)
 * URL to configure in Fawry Dashboard: Orders >> Settings => Payment Notification URL
 * Endpoint: POST /api/fawry/webhook
 */
router.post('/webhook', (req, res) => {
  const payload = req.body || {};
  console.log('[Webhook Received]', JSON.stringify(payload, null, 2));

  const {
    merchantRefNumber,
    fawryRefNumber,
    orderStatus,
    paymentAmount,
    orderAmount,
    paymentMethod,
    messageSignature
  } = payload;

  // Verify Signature
  const signatureVerification = fawryService.verifyWebhookSignature(payload);
  console.log('[Webhook Signature Verification]', signatureVerification);

  // Match order in database
  let matchedOrder = null;
  const refNum = merchantRefNumber || payload.merchantRefNum;
  const fawryNum = fawryRefNumber || payload.referenceNumber;
  const targetStatus = orderStatus || payload.paymentStatus || 'PAID';

  if (refNum) {
    matchedOrder = orderStore.getOrder(refNum);
  }
  if (!matchedOrder && fawryNum) {
    const allOrders = orderStore.getOrders();
    matchedOrder = allOrders.find(o => String(o.fawryRefNumber) === String(fawryNum));
  }

  if (matchedOrder && targetStatus) {
    orderStore.updateOrderStatus(matchedOrder.merchantRefNum, targetStatus, 'WEBHOOK_PUSH', {
      fawryRefNumber: fawryNum,
      paymentAmount,
      orderAmount,
      paymentMethod,
      incomingSignature: messageSignature,
      isValidSignature: signatureVerification.isValid,
      fullWebhookPayload: payload
    });
    console.log(`[Webhook] Order ${matchedOrder.merchantRefNum} updated to status: ${targetStatus}`);
  }

  // Log webhook event
  const logged = orderStore.logWebhook({
    payload,
    calculatedSignature: signatureVerification.calculatedSignature,
    incomingSignature: messageSignature,
    isValidSignature: signatureVerification.isValid,
    matchedOrder: matchedOrder ? { merchantRefNum: matchedOrder.merchantRefNum, testCase: matchedOrder.testCase } : null
  });

  // Fawry documentation requirement:
  // "Your server must return an HTTP status code of 200 (OK) with an empty response body"
  return res.status(200).send('');
});

/**
 * Webhook simulator endpoint for manual local testing without waiting for Fawry
 */
router.post('/webhook/simulate', (req, res) => {
  const { merchantRefNumber, orderStatus = 'PAID' } = req.body;
  const order = orderStore.getOrder(merchantRefNumber);

  if (!order) {
    return res.status(404).json({ success: false, error: 'Order not found' });
  }

  const simulatedPayload = {
    requestId: 'sim_' + Date.now(),
    fawryRefNumber: order.fawryRefNumber || '999' + Math.floor(100000 + Math.random() * 900000),
    merchantRefNumber: order.merchantRefNum,
    customerMobile: order.customerMobile,
    customerMail: order.customerEmail,
    paymentAmount: Number(order.amount).toFixed(2),
    orderAmount: Number(order.amount).toFixed(2),
    fawryFees: '2.00',
    shippingFees: '0.00',
    orderStatus: orderStatus,
    paymentMethod: order.paymentMethod,
    paymentRefNumber: 'sim_pay_' + Date.now(),
    orderExpiryDate: order.paymentExpiry || Date.now() + 86400000
  };

  const rawString = `${simulatedPayload.fawryRefNumber}${simulatedPayload.merchantRefNumber}${simulatedPayload.paymentAmount}${simulatedPayload.orderAmount}${simulatedPayload.orderStatus}${simulatedPayload.paymentMethod}${simulatedPayload.paymentRefNumber}${fawryService.secureKey}`;
  simulatedPayload.messageSignature = fawryService.hashSHA256(rawString);

  // Apply to order store
  orderStore.updateOrderStatus(order.merchantRefNum, orderStatus, 'WEBHOOK_SIMULATION', {
    fawryRefNumber: simulatedPayload.fawryRefNumber,
    simulatedPayload
  });

  // Log webhook
  orderStore.logWebhook({
    payload: simulatedPayload,
    calculatedSignature: simulatedPayload.messageSignature,
    incomingSignature: simulatedPayload.messageSignature,
    isValidSignature: true,
    matchedOrder: { merchantRefNum: order.merchantRefNum, testCase: order.testCase }
  });

  return res.json({
    success: true,
    message: `Simulated webhook for ${order.merchantRefNum} -> ${orderStatus}`,
    payload: simulatedPayload
  });
});

module.exports = router;
