const cron = require('node-cron');
const orderStore = require('./orderStore');
const fawryService = require('./fawryService');

class PullJobManager {
  constructor() {
    this.cronTask = null;
    this.stats = {
      isRunning: false,
      lastRun: null,
      ordersChecked: 0,
      ordersUpdated: 0,
      lastError: null,
      history: []
    };
  }

  start() {
    if (this.cronTask) {
      this.cronTask.stop();
    }

    const intervalSeconds = Number(process.env.PULL_JOB_INTERVAL_SECONDS) || 30;
    // node-cron expression for every X seconds
    // or standard cron */1 * * * * for every minute
    const cronExpr = `*/${Math.max(10, intervalSeconds)} * * * * *`;

    console.log(`[PullJob] Starting Pull Model scheduled job with expression: ${cronExpr}`);
    this.stats.isRunning = true;

    this.cronTask = cron.schedule(cronExpr, async () => {
      await this.runJob('SCHEDULED');
    });
  }

  stop() {
    if (this.cronTask) {
      this.cronTask.stop();
      this.cronTask = null;
    }
    this.stats.isRunning = false;
    console.log('[PullJob] Stopped scheduled job');
  }

  async runJob(triggerSource = 'MANUAL') {
    const timestamp = new Date().toISOString();
    this.stats.lastRun = timestamp;

    // Check if Fawry is configured
    if (!fawryService.isConfigured()) {
      const msg = 'Fawry credentials not configured yet in .env (merchantCode/secureKey). Pull job paused.';
      this.stats.lastError = msg;
      return { success: false, message: msg, checked: 0, updated: 0 };
    }

    try {
      const allOrders = orderStore.getOrders();
      const now = Date.now();

      // Process all pending / unpaid orders
      const pendingOrders = allOrders.filter(order => ['NEW', 'UNPAID'].includes(order.orderStatus));
      this.stats.ordersChecked = pendingOrders.length;
      let updatedCount = 0;

      for (const order of pendingOrders) {
        try {
          const isExpiredLocally = order.paymentExpiry && Number(order.paymentExpiry) <= now;

          // Call Fawry Status Inquiry V2
          const result = await fawryService.getPaymentStatus(order.merchantRefNum);

          if (result.success && result.data) {
            let fawryStatus = result.data.paymentStatus || result.data.orderStatus;
            const fawryRefNumber = result.data.fawryRefNumber;

            // If order has expired based on paymentExpiry timestamp and not paid
            if (isExpiredLocally && fawryStatus !== 'PAID') {
              fawryStatus = 'EXPIRED';
            }

            if (fawryStatus && fawryStatus !== order.orderStatus) {
              orderStore.updateOrderStatus(order.merchantRefNum, fawryStatus, `PULL_JOB_${triggerSource}`, {
                fawryRefNumber,
                lastInquiryResponse: result.data
              });
              updatedCount++;
            }
          } else if (isExpiredLocally) {
            // If Fawry call had no change but expiration timestamp passed
            orderStore.updateOrderStatus(order.merchantRefNum, 'EXPIRED', `PULL_JOB_EXPIRY_TIMEOUT`, {
              note: 'Order paymentExpiry timestamp elapsed'
            });
            updatedCount++;
          }
        } catch (err) {
          console.error(`[PullJob] Failed status check for ${order.merchantRefNum}:`, err.message);
        }
      }

      this.stats.ordersUpdated = updatedCount;
      this.stats.lastError = null;

      const logEntry = {
        timestamp,
        triggerSource,
        checked: pendingOrders.length,
        updated: updatedCount
      };

      this.stats.history.unshift(logEntry);
      if (this.stats.history.length > 20) this.stats.history.pop();

      return {
        success: true,
        message: `Pull executed successfully. Checked ${pendingOrders.length} orders, updated ${updatedCount}.`,
        checked: pendingOrders.length,
        updated: updatedCount
      };
    } catch (err) {
      this.stats.lastError = err.message;
      return { success: false, error: err.message, checked: 0, updated: 0 };
    }
  }

  getStats() {
    return {
      ...this.stats,
      isConfigured: fawryService.isConfigured()
    };
  }
}

module.exports = new PullJobManager();
