const crypto = require('crypto');
const axios = require('axios');

class FawryService {
  constructor() {
    this.merchantCode = process.env.FAWRY_MERCHANT_CODE || 'YOUR_MERCHANT_CODE_HERE';
    this.secureKey = process.env.FAWRY_SECURE_KEY || 'YOUR_SECURE_KEY_HERE';
    this.baseUrl = process.env.FAWRY_BASE_URL || 'https://atfawry.fawrystaging.com';
    this.appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
  }

  // Refresh config from process.env if updated
  refreshConfig() {
    this.merchantCode = process.env.FAWRY_MERCHANT_CODE || 'YOUR_MERCHANT_CODE_HERE';
    this.secureKey = process.env.FAWRY_SECURE_KEY || 'YOUR_SECURE_KEY_HERE';
    this.baseUrl = process.env.FAWRY_BASE_URL || 'https://atfawry.fawrystaging.com';
    this.appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
  }

  isConfigured() {
    this.refreshConfig();
    return (
      this.merchantCode &&
      this.merchantCode !== 'YOUR_MERCHANT_CODE_HERE' &&
      this.secureKey &&
      this.secureKey !== 'YOUR_SECURE_KEY_HERE'
    );
  }

  /**
   * SHA-256 helper
   */
  hashSHA256(str) {
    return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
  }

  /**
   * 1. Standard Charge Signature (PAYATFAWRY / MWALLET / CARD)
   * Formula: merchantCode + merchantRefNum + customerProfileId + paymentMethod + amount + secureKey
   */
  generateChargeSignature({ merchantRefNum, customerProfileId = '', paymentMethod, amount }) {
    this.refreshConfig();
    const formattedAmount = Number(amount).toFixed(2);
    const rawString = `${this.merchantCode}${merchantRefNum}${customerProfileId || ''}${paymentMethod}${formattedAmount}${this.secureKey}`;
    return {
      rawString,
      signature: this.hashSHA256(rawString)
    };
  }

  /**
   * 2. Express Checkout / Hosted Link Signature (with chargeItems & returnUrl)
   * Formula: merchantCode + merchantRefNum + customerProfileId + returnUrl + (itemId + quantity + price.toFixed(2)) + secureKey
   */
  generateCheckoutItemsSignature({ merchantRefNum, customerProfileId = '', returnUrl, chargeItems = [] }) {
    this.refreshConfig();
    const sorted = [...chargeItems].sort((a, b) => String(a.itemId).localeCompare(String(b.itemId)));
    let itemsString = '';
    sorted.forEach(item => {
      itemsString += `${item.itemId}${item.quantity}${Number(item.price).toFixed(2)}`;
    });
    const rawString = `${this.merchantCode}${merchantRefNum}${customerProfileId || ''}${returnUrl}${itemsString}${this.secureKey}`;
    return {
      rawString,
      signature: this.hashSHA256(rawString)
    };
  }

  /**
   * 3. Status Inquiry Signature V2 (Pull Model)
   * Formula: merchantCode + merchantRefNumber + secureKey
   */
  generateStatusSignature(merchantRefNumber) {
    this.refreshConfig();
    const rawString = `${this.merchantCode}${merchantRefNumber}${this.secureKey}`;
    return {
      rawString,
      signature: this.hashSHA256(rawString)
    };
  }

  /**
   * 4. Server Notification V2 Signature Verification (Push Model - Webhook)
   * Formula: fawryRefNumber + merchantRefNumber + paymentAmount(2dec) + orderAmount(2dec) + orderStatus + paymentMethod + (paymentRefNumber || "") + secureKey
   */
  verifyWebhookSignature(body) {
    this.refreshConfig();
    const fawryRefNumber = body.fawryRefNumber || body.referenceNumber || '';
    const merchantRefNumber = body.merchantRefNumber || body.merchantRefNum || '';
    const paymentAmount = body.paymentAmount !== undefined ? body.paymentAmount : (body.orderAmount || 0);
    const orderAmount = body.orderAmount !== undefined ? body.orderAmount : (body.paymentAmount || 0);
    const orderStatus = body.orderStatus || body.paymentStatus || '';
    const paymentMethod = body.paymentMethod || '';
    const paymentRefNumber = body.paymentRefNumber || body.paymentRefrenceNumber || '';
    const messageSignature = String(body.messageSignature || body.signature || '').toLowerCase();

    const formattedPaymentAmount = Number(paymentAmount).toFixed(2);
    const formattedOrderAmount = Number(orderAmount).toFixed(2);

    // Standard V2 formula: fawryRefNumber + merchantRefNumber + paymentAmount + orderAmount + orderStatus + paymentMethod + (paymentRefNumber || "") + secureKey
    const rawString1 = `${fawryRefNumber}${merchantRefNumber}${formattedPaymentAmount}${formattedOrderAmount}${orderStatus}${paymentMethod}${paymentRefNumber}${this.secureKey}`;
    const hash1 = this.hashSHA256(rawString1).toLowerCase();

    // Variant 2: without paymentRefNumber if empty
    const rawString2 = `${fawryRefNumber}${merchantRefNumber}${formattedPaymentAmount}${formattedOrderAmount}${orderStatus}${paymentMethod}${this.secureKey}`;
    const hash2 = this.hashSHA256(rawString2).toLowerCase();

    // Variant 3: with fawryFees if present
    const fawryFees = body.fawryFees !== undefined ? Number(body.fawryFees).toFixed(2) : '';
    const rawString3 = `${fawryRefNumber}${merchantRefNumber}${formattedPaymentAmount}${formattedOrderAmount}${orderStatus}${paymentMethod}${fawryFees}${paymentRefNumber}${this.secureKey}`;
    const hash3 = this.hashSHA256(rawString3).toLowerCase();

    const isValid = Boolean(messageSignature && (messageSignature === hash1 || messageSignature === hash2 || messageSignature === hash3));

    return {
      isValid,
      calculatedSignature: hash1,
      incomingSignature: messageSignature,
      rawString: rawString1
    };
  }

  /**
   * 5. Call Fawry Charge API
   * Endpoint: /ECommerceWeb/Fawry/payments/charge
   */
  async createChargeRequest({
    merchantRefNum,
    paymentMethod = 'PAYATFAWRY',
    amount = '100.00',
    customerMobile = '01000000000',
    customerEmail = 'test@domain.com',
    customerName = 'Test User',
    customerProfileId = '',
    paymentExpiry = null,
    description = 'Fawry Test Order',
    returnUrl = null
  }) {
    this.refreshConfig();

    const formattedAmount = Number(amount).toFixed(2);
    const { rawString, signature } = this.generateChargeSignature({
      merchantRefNum,
      customerProfileId,
      paymentMethod,
      amount: formattedAmount
    });

    const payload = {
      merchantCode: this.merchantCode,
      merchantRefNum: String(merchantRefNum),
      customerMobile,
      customerEmail,
      customerName,
      customerProfileId: customerProfileId || '',
      paymentMethod,
      amount: formattedAmount,
      currencyCode: 'EGP',
      language: 'en-gb',
      chargeItems: [
        {
          itemId: 'item_1',
          description,
          price: formattedAmount,
          quantity: 1
        }
      ],
      signature
    };

    if (paymentExpiry) {
      payload.paymentExpiry = String(paymentExpiry);
    }

    if (returnUrl) {
      payload.returnUrl = returnUrl;
    }

    // Attach Webhook / Notification URL directly with the request
    const webhookEndpoint = `${this.appBaseUrl}/api/fawry/webhook`;
    payload.orderWebHookUrl = webhookEndpoint;
    payload.notificationUrl = webhookEndpoint;
    payload.merchantCallbackUrl = webhookEndpoint;
    payload.callbackUrl = webhookEndpoint;

    const endpoint = `${this.baseUrl}/ECommerceWeb/Fawry/payments/charge`;

    try {
      const response = await axios.post(endpoint, payload, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });

      return {
        success: true,
        statusCode: response.status,
        data: response.data,
        requestPayload: payload,
        signatureDebug: { rawString, signature }
      };
    } catch (err) {
      return {
        success: false,
        error: err.response ? err.response.data : err.message,
        statusCode: err.response ? err.response.status : 500,
        requestPayload: payload,
        signatureDebug: { rawString, signature }
      };
    }
  }

  /**
   * 5b. Call Fawry Express Checkout Link Init API (for Credit Card / Hosted Gateway)
   * Endpoint: /fawrypay-api/api/payments/init
   */
  async initCheckoutLink({
    merchantRefNum,
    amount = '150.00',
    customerMobile = '01000000000',
    customerEmail = 'customer@domain.com',
    customerName = 'Test Customer',
    customerProfileId = '',
    description = 'Test Credit Card Payment',
    returnUrl
  }) {
    this.refreshConfig();

    const formattedAmount = Number(amount).toFixed(2);
    const chargeItems = [
      {
        itemId: 'item_1',
        description,
        price: formattedAmount,
        quantity: 1
      }
    ];

    const { rawString, signature } = this.generateCheckoutItemsSignature({
      merchantRefNum,
      customerProfileId,
      returnUrl,
      chargeItems
    });

    const payload = {
      merchantCode: this.merchantCode,
      merchantRefNum: String(merchantRefNum),
      customerMobile,
      customerEmail,
      customerName,
      customerProfileId: customerProfileId || '',
      amount: Number(formattedAmount),
      currencyCode: 'EGP',
      language: 'en-gb',
      chargeItems,
      returnUrl,
      webhookUrl: `${this.appBaseUrl}/api/fawry/webhook`,
      notificationUrl: `${this.appBaseUrl}/api/fawry/webhook`,
      merchantCallbackUrl: `${this.appBaseUrl}/api/fawry/webhook`,
      callbackUrl: `${this.appBaseUrl}/api/fawry/webhook`,
      signature
    };

    const endpoint = `${this.baseUrl}/fawrypay-api/api/payments/init`;

    try {
      const response = await axios.post(endpoint, payload, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });

      // Fawry returns the hosted checkout URL string directly as response.data
      const paymentUrl = typeof response.data === 'string' ? response.data : (response.data.paymentUrl || response.data);

      return {
        success: true,
        statusCode: response.status,
        paymentUrl: typeof paymentUrl === 'string' ? paymentUrl : null,
        data: response.data,
        requestPayload: payload,
        signatureDebug: { rawString, signature }
      };
    } catch (err) {
      return {
        success: false,
        error: err.response ? err.response.data : err.message,
        statusCode: err.response ? err.response.status : 500,
        requestPayload: payload,
        signatureDebug: { rawString, signature }
      };
    }
  }

  /**
   * 6. Call Fawry Status Inquiry V2 (Pull Model)
   * Endpoint: /ECommerceWeb/Fawry/payments/status/v2
   */
  async getPaymentStatus(merchantRefNumber) {
    this.refreshConfig();

    const { rawString, signature } = this.generateStatusSignature(merchantRefNumber);
    const endpoint = `${this.baseUrl}/ECommerceWeb/Fawry/payments/status/v2`;

    try {
      const response = await axios.get(endpoint, {
        params: {
          merchantCode: this.merchantCode,
          merchantRefNumber: String(merchantRefNumber),
          signature
        },
        timeout: 15000
      });

      return {
        success: true,
        statusCode: response.status,
        data: response.data,
        signatureDebug: { rawString, signature }
      };
    } catch (err) {
      return {
        success: false,
        error: err.response ? err.response.data : err.message,
        statusCode: err.response ? err.response.status : 500,
        signatureDebug: { rawString, signature }
      };
    }
  }
}

module.exports = new FawryService();
