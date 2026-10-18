const express = require('express');
const router = express.Router();
const orderStore = require('../services/orderStore');
const fawryService = require('../services/fawryService');
const pullJob = require('../services/pullJob');

/**
 * Main Fawry Integration Test Dashboard
 */
router.get('/', (req, res) => {
  const orders = orderStore.getOrders();
  const webhooks = orderStore.getWebhooks();
  const pullStats = pullJob.getStats();
  const isConfigured = fawryService.isConfigured();

  // Calculate statistics across test cases
  const stats = {
    totalOrders: orders.length,
    paidOrders: orders.filter(o => o.orderStatus === 'PAID').length,
    unpaidOrders: orders.filter(o => ['NEW', 'UNPAID'].includes(o.orderStatus)).length,
    expiredOrders: orders.filter(o => o.orderStatus === 'EXPIRED').length,
    failedOrders: orders.filter(o => ['FAILED', 'CANCELED', 'CANCELLED'].includes(o.orderStatus)).length,
    totalWebhooks: webhooks.length
  };

  // Test case completion tracker
  const testCasesStatus = {
    paidRefNumber: orders.some(o => o.testCase === 'Paid fawry reference number' && o.orderStatus === 'PAID'),
    expiredRefNumber: orders.some(o => o.testCase === 'Expired fawry reference number' && o.orderStatus === 'EXPIRED'),
    creditCardSuccess: orders.some(o => o.testCase === 'Success Credit Card Transaction' && o.orderStatus === 'PAID'),
    creditCardFailed: orders.some(o => o.testCase === 'Failed Credit Card Transaction' && ['FAILED', 'CANCELED'].includes(o.orderStatus)),
    eWallet: orders.some(o => o.testCase === 'Paid Mobile Wallet'),
    myFawryApp: orders.some(o => o.testCase === 'Paid MyFawryApp Order'),
    webhookPush: webhooks.length > 0 && webhooks.some(w => w.isValidSignature),
    pullModel: pullStats.lastRun !== null
  };

  res.render('index', {
    pageTitle: 'FawryPay Integration Test Cases Hub',
    orders: orders.slice(0, 15),
    webhooks: webhooks.slice(0, 5),
    stats,
    testCasesStatus,
    pullStats,
    isConfigured,
    config: {
      merchantCode: fawryService.merchantCode,
      secureKey: fawryService.secureKey ? '••••••••' + fawryService.secureKey.slice(-4) : 'NOT SET',
      baseUrl: fawryService.baseUrl,
      appBaseUrl: fawryService.appBaseUrl,
      webhookUrl: `${fawryService.appBaseUrl}/api/fawry/webhook`
    }
  });
});

/**
 * JSON Endpoint for Live Dashboard UI updates
 */
router.get('/api/dashboard/status', (req, res) => {
  const orders = orderStore.getOrders();
  const webhooks = orderStore.getWebhooks();
  const pullStats = pullJob.getStats();

  const stats = {
    totalOrders: orders.length,
    paidOrders: orders.filter(o => o.orderStatus === 'PAID').length,
    unpaidOrders: orders.filter(o => ['NEW', 'UNPAID'].includes(o.orderStatus)).length,
    expiredOrders: orders.filter(o => o.orderStatus === 'EXPIRED').length,
    failedOrders: orders.filter(o => ['FAILED', 'CANCELED', 'CANCELLED'].includes(o.orderStatus)).length,
    totalWebhooks: webhooks.length
  };

  const testCasesStatus = {
    paidRefNumber: orders.some(o => o.testCase === 'Paid fawry reference number' && o.orderStatus === 'PAID'),
    expiredRefNumber: orders.some(o => o.testCase === 'Expired fawry reference number' && o.orderStatus === 'EXPIRED'),
    creditCardSuccess: orders.some(o => o.testCase === 'Success Credit Card Transaction' && o.orderStatus === 'PAID'),
    creditCardFailed: orders.some(o => o.testCase === 'Failed Credit Card Transaction' && ['FAILED', 'CANCELED'].includes(o.orderStatus)),
    eWallet: orders.some(o => o.testCase === 'Paid Mobile Wallet'),
    myFawryApp: orders.some(o => o.testCase === 'Paid MyFawryApp Order'),
    webhookPush: webhooks.length > 0 && webhooks.some(w => w.isValidSignature),
    pullModel: pullStats.lastRun !== null
  };

  res.json({
    orders: orders.slice(0, 15),
    webhooks: webhooks.slice(0, 5),
    stats,
    testCasesStatus,
    pullStats
  });
});

/**
 * View Single Order Details
 */
router.get('/orders/:merchantRefNum', (req, res) => {
  const { merchantRefNum } = req.params;
  const order = orderStore.getOrder(merchantRefNum);

  if (!order) {
    return res.status(404).render('404', { message: `Order #${merchantRefNum} not found` });
  }

  const webhooks = orderStore.getWebhooks().filter(w =>
    w.payload && (w.payload.merchantRefNumber === merchantRefNum || (order.fawryRefNumber && w.payload.fawryRefNumber === order.fawryRefNumber))
  );

  res.render('order-details', {
    pageTitle: `Order #${order.merchantRefNum}`,
    order,
    relatedWebhooks: webhooks,
    isConfigured: fawryService.isConfigured()
  });
});

/**
 * Webhooks Inspector View
 */
router.get('/webhooks', (req, res) => {
  const webhooks = orderStore.getWebhooks();
  res.render('webhooks', {
    pageTitle: 'Server Notification V2 Inspector',
    webhooks,
    webhookUrl: `${fawryService.appBaseUrl}/api/fawry/webhook`,
    isConfigured: fawryService.isConfigured()
  });
});

/**
 * Credit Card Return URL Page
 */
router.get('/payment/return', (req, res) => {
  const query = req.query || {};
  console.log('[Return URL Received]', query);

  const {
    merchantRefNum,
    fawryRefNumber,
    orderStatus,
    paymentAmount,
    signature
  } = query;

  let order = null;
  if (merchantRefNum) {
    order = orderStore.getOrder(merchantRefNum);
    if (order && orderStatus) {
      orderStore.updateOrderStatus(merchantRefNum, orderStatus, 'CARD_REDIRECT_RETURN', {
        fawryRefNumber,
        paymentAmount,
        query
      });
    }
  }

  res.render('return', {
    pageTitle: 'Payment Result',
    query,
    order,
    status: orderStatus || (query.statusDescription ? query.statusDescription : 'UNKNOWN')
  });
});

/**
 * Config & Environment Details
 */
router.get('/config', (req, res) => {
  res.render('config', {
    pageTitle: 'Fawry Configuration & Environment',
    isConfigured: fawryService.isConfigured(),
    config: {
      merchantCode: fawryService.merchantCode,
      secureKey: fawryService.secureKey,
      baseUrl: fawryService.baseUrl,
      appBaseUrl: fawryService.appBaseUrl,
      webhookUrl: `${fawryService.appBaseUrl}/api/fawry/webhook`
    }
  });
});

module.exports = router;
