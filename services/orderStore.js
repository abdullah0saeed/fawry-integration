const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const WEBHOOKS_FILE = path.join(DATA_DIR, 'webhooks.json');

// Ensure directory and files exist
function ensureStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(ORDERS_FILE)) {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
  if (!fs.existsSync(WEBHOOKS_FILE)) {
    fs.writeFileSync(WEBHOOKS_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}

ensureStorage();

function getOrders() {
  ensureStorage();
  try {
    const raw = fs.readFileSync(ORDERS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading orders.json:', err.message);
    return [];
  }
}

function saveOrders(orders) {
  ensureStorage();
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf-8');
}

function getOrder(merchantRefNum) {
  const orders = getOrders();
  return orders.find(o => String(o.merchantRefNum) === String(merchantRefNum));
}

function createOrder(orderData) {
  const orders = getOrders();
  const newOrder = {
    id: 'ord_' + Date.now(),
    merchantRefNum: orderData.merchantRefNum,
    fawryRefNumber: orderData.fawryRefNumber || null,
    testCase: orderData.testCase || 'Standard',
    paymentMethod: orderData.paymentMethod || 'PAYATFAWRY',
    amount: Number(orderData.amount).toFixed(2),
    customerMobile: orderData.customerMobile || '01000000000',
    customerEmail: orderData.customerEmail || 'test@domain.com',
    customerName: orderData.customerName || 'Test Customer',
    orderStatus: orderData.orderStatus || 'NEW',
    paymentExpiry: orderData.paymentExpiry || null,
    paymentExpiryDate: orderData.paymentExpiry ? new Date(Number(orderData.paymentExpiry)).toISOString() : null,
    rawResponse: orderData.rawResponse || null,
    lastInquiryResponse: null,
    history: [
      {
        timestamp: new Date().toISOString(),
        action: 'CREATED',
        note: `Order initiated for test case: ${orderData.testCase || 'Standard'}`
      }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  orders.unshift(newOrder);
  saveOrders(orders);
  return newOrder;
}

function updateOrderStatus(merchantRefNum, newStatus, source = 'SYSTEM', details = {}) {
  const orders = getOrders();
  const index = orders.findIndex(o => String(o.merchantRefNum) === String(merchantRefNum));

  if (index === -1) {
    console.warn(`Order not found for status update: ${merchantRefNum}`);
    return null;
  }

  const prevStatus = orders[index].orderStatus;
  orders[index].orderStatus = newStatus;
  orders[index].updatedAt = new Date().toISOString();

  if (details.fawryRefNumber && !orders[index].fawryRefNumber) {
    orders[index].fawryRefNumber = details.fawryRefNumber;
  }
  if (details.lastInquiryResponse) {
    orders[index].lastInquiryResponse = details.lastInquiryResponse;
  }

  orders[index].history.unshift({
    timestamp: new Date().toISOString(),
    action: `STATUS_CHANGED_${newStatus}`,
    source,
    from: prevStatus,
    to: newStatus,
    details
  });

  saveOrders(orders);
  return orders[index];
}

function getWebhooks() {
  ensureStorage();
  try {
    const raw = fs.readFileSync(WEBHOOKS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading webhooks.json:', err.message);
    return [];
  }
}

function logWebhook(webhookData) {
  ensureStorage();
  const webhooks = getWebhooks();
  const entry = {
    id: 'wh_' + Date.now(),
    receivedAt: new Date().toISOString(),
    payload: webhookData.payload,
    calculatedSignature: webhookData.calculatedSignature,
    incomingSignature: webhookData.incomingSignature,
    isValidSignature: webhookData.isValidSignature,
    matchedOrder: webhookData.matchedOrder || null
  };

  webhooks.unshift(entry);
  if (webhooks.length > 100) webhooks.pop(); // keep last 100
  fs.writeFileSync(WEBHOOKS_FILE, JSON.stringify(webhooks, null, 2), 'utf-8');
  return entry;
}

module.exports = {
  getOrders,
  getOrder,
  createOrder,
  updateOrderStatus,
  getWebhooks,
  logWebhook
};
