// ============================================================
// FAWRYPAY INTEGRATION TEST SUITE - CLIENT CONTROLLER
// ============================================================

// Utility: floating toast notification
function showToast(msg, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast-item toast-${type}`;
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
  toast.innerHTML = `<span style="font-weight: 700;">${icon}</span><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'all 0.3s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// Utility: copy text to clipboard with visual toast
function copyText(text, elem) {
  navigator.clipboard.writeText(text).then(() => {
    if (elem) {
      const originalText = elem.innerText;
      elem.innerText = 'Copied! ✓';
      setTimeout(() => {
        elem.innerText = originalText;
      }, 1500);
    }
    showToast('Copied: ' + text, 'success');
  }).catch(err => {
    console.error('Failed to copy: ', err);
    showToast('Failed to copy to clipboard', 'error');
  });
}

// Modal management
const resultModal = document.getElementById('resultModal');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');
const modalPrimaryBtn = document.getElementById('modalPrimaryBtn');
const modalCloseBtn = document.getElementById('modalCloseBtn');

function showModal({ title, bodyHtml, buttonText = 'Done', onButtonClick = null }) {
  if (!resultModal) return;
  modalTitle.innerText = title;
  modalBody.innerHTML = bodyHtml;
  modalPrimaryBtn.innerText = buttonText;
  modalPrimaryBtn.onclick = onButtonClick ? onButtonClick : hideModal;
  resultModal.classList.remove('hidden');
}

function hideModal() {
  if (resultModal) {
    resultModal.classList.add('hidden');
  }
}

if (modalCloseBtn) modalCloseBtn.onclick = hideModal;
if (modalPrimaryBtn) modalPrimaryBtn.onclick = hideModal;
window.onclick = function(event) {
  if (event.target === resultModal) hideModal();
};

function toggleBtnLoading(btn, isLoading) {
  if (!btn) return;
  const spinner = btn.querySelector('.spinner');
  btn.disabled = isLoading;
  if (spinner) {
    spinner.classList.toggle('hidden', !isLoading);
  }
}

// ------------------------------------------------------------
// 1. Paid Fawry Reference Number Test Case
// ------------------------------------------------------------
async function handlePaidRef(event) {
  event.preventDefault();
  const form = event.target;
  const btn = form.querySelector('button[type="submit"]');
  const amount = form.elements['amount'].value;
  const mobile = form.elements['mobile'].value;

  toggleBtnLoading(btn, true);

  try {
    const res = await fetch('/api/payment/create-fawry-ref', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, mobile })
    });
    const data = await res.json();

    toggleBtnLoading(btn, false);

    if (data.success) {
      const refNum = data.fawryRefNumber;
      showModal({
        title: 'Fawry Pay Reference Number Generated!',
        bodyHtml: `
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 6px;">Your Fawry Reference Number:</div>
            <div style="font-size: 26px; font-weight: 800; font-family: var(--font-mono); color: var(--fawry-amber); background: rgba(245, 158, 11, 0.1); padding: 12px; border-radius: 8px; border: 1px dashed var(--fawry-amber); display: inline-block; cursor: pointer;" onclick="copyText('${refNum}', this)">
              ${refNum} 📋
            </div>
            <div style="font-size: 12px; color: var(--text-dim); margin-top: 6px;">Click number above to copy to clipboard</div>
          </div>
          <div style="background: rgba(255, 255, 255, 0.04); border-radius: 8px; padding: 14px; font-size: 13px; line-height: 1.6; margin-bottom: 16px;">
            <strong>Test Case Next Steps:</strong>
            <ol style="padding-left: 20px; margin-top: 6px;">
              <li>Go to Fawry Staging Pay Order Portal: <a href="https://developer.fawrystaging.com/public/pay-order/" target="_blank" style="color: var(--fawry-amber);">developer.fawrystaging.com/public/pay-order/ ↗</a></li>
              <li>Paste this reference number: <code>${refNum}</code> and complete the payment.</li>
              <li>Your webhook or scheduled pull job will automatically mark this order <strong>PAID</strong>!</li>
            </ol>
          </div>
          <div style="display: flex; gap: 10px;">
            <a href="https://developer.fawrystaging.com/public/pay-order/" target="_blank" class="btn btn-primary" style="flex: 1;">Open Fawry Pay Portal ↗</a>
            <a href="/orders/${data.order.merchantRefNum}" class="btn btn-secondary" style="flex: 1;">View Order Status</a>
          </div>
        `,
        buttonText: 'Close & Refresh Table',
        onButtonClick: () => { hideModal(); location.reload(); }
      });
    } else {
      alert('Error generating Fawry Ref: ' + (data.error || 'Unknown error'));
    }
  } catch (err) {
    toggleBtnLoading(btn, false);
    alert('Request failed: ' + err.message);
  }
}

// ------------------------------------------------------------
// 2. Expired Fawry Reference Number Test Case
// ------------------------------------------------------------
async function handleExpiredRef(event) {
  event.preventDefault();
  const form = event.target;
  const btn = form.querySelector('button[type="submit"]');
  const amount = form.elements['amount'].value;
  const expiryMinutes = form.elements['expiryMinutes'].value;

  toggleBtnLoading(btn, true);

  try {
    const res = await fetch('/api/payment/create-expired-ref', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, expiryMinutes })
    });
    const data = await res.json();

    toggleBtnLoading(btn, false);

    if (data.success) {
      const refNum = data.fawryRefNumber;
      showModal({
        title: 'Expiring Fawry Order Generated!',
        bodyHtml: `
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 6px;">Fawry Reference Code:</div>
            <div style="font-size: 26px; font-weight: 800; font-family: var(--font-mono); color: #fbbf24; background: rgba(245, 158, 11, 0.1); padding: 12px; border-radius: 8px; border: 1px dashed #fbbf24; display: inline-block;">
              ${refNum}
            </div>
            <div style="font-size: 13px; color: var(--text-dim); margin-top: 8px;">
              Configured Expiry: <strong>${expiryMinutes} minute(s)</strong> (${new Date(data.expiryTimestamp).toLocaleTimeString()})
            </div>
          </div>
          <div style="background: rgba(255, 255, 255, 0.04); border-radius: 8px; padding: 14px; font-size: 13px; line-height: 1.6; margin-bottom: 16px;">
            <strong>Test Case Steps:</strong>
            <ol style="padding-left: 20px; margin-top: 6px;">
              <li>Wait for ${expiryMinutes} minute(s) until expiration timestamp passes.</li>
              <li>When expired, querying status via Pull Model or receiving Webhook will update this order status to <strong>EXPIRED</strong>.</li>
              <li>You can also click "Check Status (Pull)" in the orders table to verify status directly from Fawry.</li>
            </ol>
          </div>
          <div style="display: flex; gap: 10px;">
            <a href="/orders/${data.order.merchantRefNum}" class="btn btn-secondary" style="flex: 1;">View Order Status</a>
          </div>
        `,
        buttonText: 'Close & Refresh Table',
        onButtonClick: () => { hideModal(); location.reload(); }
      });
    } else {
      alert('Error: ' + (data.error || 'Failed to create order'));
    }
  } catch (err) {
    toggleBtnLoading(btn, false);
    alert('Request failed: ' + err.message);
  }
}

// ------------------------------------------------------------
// 3 & 4. Credit Card Test Cases (Success & Failed)
// ------------------------------------------------------------
async function handleCreditCard(event, scenario) {
  event.preventDefault();
  const form = event.target;
  const btn = form.querySelector('button[type="submit"]');
  const amount = form.elements['amount'].value;

  toggleBtnLoading(btn, true);

  try {
    const res = await fetch('/api/payment/create-card', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, scenario })
    });
    const data = await res.json();

    toggleBtnLoading(btn, false);

    if (data.success) {
      const isSuccess = scenario === 'SUCCESS';
      const cardNum = isSuccess ? '4508 7500 1574 1019' : '5078 0967 0005 3444';
      const cvv = '100';
      const exp = '01/39';
      const otp = '123456';

      // Check if FawryPay JS plugin checkout is available on window
      const hasFawryPlugin = typeof window.FawryPay !== 'undefined' && typeof window.FawryPay.checkout === 'function';

      showModal({
        title: `${scenario === 'SUCCESS' ? 'Success' : 'Failed'} Credit Card Test Session`,
        bodyHtml: `
          <div style="margin-bottom: 16px;">
            <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 8px;">
              Use the following Fawry staging test card:
            </div>
            <div style="background: ${isSuccess ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; border: 1px solid ${isSuccess ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}; border-radius: 8px; padding: 14px; font-family: var(--font-mono); font-size: 13px;">
              <div>Card Number: <strong style="cursor: pointer;" onclick="copyText('${cardNum.replace(/ /g, '')}', this)">${cardNum} 📋</strong></div>
              <div style="margin-top: 4px;">CVV: <strong>${cvv}</strong> | Expiry: <strong>${exp}</strong> ${!isSuccess ? '| OTP: <strong>' + otp + '</strong>' : ''}</div>
              <div style="margin-top: 4px; font-size: 11px; color: var(--text-dim);">Holder: Fawry Test</div>
            </div>
          </div>

          <div style="background: rgba(255, 255, 255, 0.04); border-radius: 8px; padding: 12px; font-size: 12px; margin-bottom: 16px;">
            Order <code>#${data.order.merchantRefNum}</code> initiated with returnUrl <code>${data.checkoutPayload.returnUrl}</code>.
          </div>

          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${data.paymentUrl ? `
              <a href="${data.paymentUrl}" target="_blank" class="btn btn-primary" style="font-size: 14px; padding: 12px;">
                💳 Pay on Fawry Gateway ↗
              </a>
            ` : ''}
            <a href="/orders/${data.order.merchantRefNum}" class="btn btn-secondary">View Order Details</a>
          </div>
        `,
        buttonText: 'Close',
        onButtonClick: () => { hideModal(); location.reload(); }
      });

      // Bind Fawry modal if plugin exists
      const modalLaunchBtn = document.getElementById('btn-open-fawry-modal');
      if (modalLaunchBtn && hasFawryPlugin) {
        modalLaunchBtn.onclick = () => {
          try {
            window.FawryPay.checkout(data.checkoutPayload, {
              locale: 'en',
              mode: window.FawryPay.modes.POPUP,
              onSuccess: function (res) {
                console.log('FawryPay Success', res);
                location.href = `/payment/return?merchantRefNum=${data.order.merchantRefNum}&orderStatus=PAID&paymentAmount=${amount}`;
              },
              onFailure: function (err) {
                console.log('FawryPay Failure', err);
                location.href = `/payment/return?merchantRefNum=${data.order.merchantRefNum}&orderStatus=FAILED&paymentAmount=${amount}`;
              }
            });
          } catch (e) {
            console.error('Fawry plugin launch error:', e);
            alert('Fawry checkout plugin error: ' + e.message);
          }
        };
      }
    } else {
      alert('Error: ' + (data.error || 'Failed to initiate card session'));
    }
  } catch (err) {
    toggleBtnLoading(btn, false);
    alert('Request failed: ' + err.message);
  }
}

// ------------------------------------------------------------
// 5. E-Wallet (Paid Mobile Wallet) Test Case
// ------------------------------------------------------------
async function handleWallet(event) {
  event.preventDefault();
  const form = event.target;
  const btn = form.querySelector('button[type="submit"]');
  const amount = form.elements['amount'].value;
  const mobile = form.elements['mobile'].value;

  toggleBtnLoading(btn, true);

  try {
    const res = await fetch('/api/payment/create-wallet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, mobile })
    });
    const data = await res.json();

    toggleBtnLoading(btn, false);

    if (data.success) {
      showModal({
        title: 'E-Wallet Order Generated (Passed!)',
        bodyHtml: `
          <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 14px; margin-bottom: 16px;">
            <div style="font-weight: 700; color: #34d399; margin-bottom: 4px;">✓ Test Case Completed Successfully!</div>
            <p style="font-size: 13px; color: var(--text-muted); line-height: 1.5;">
              As stated in Fawry Staging documentation:
              <em>"Once you succeeded to generate the order whatever it's 'QR Code' or 'R2P', you passed the E-Wallet test as it's connected to an online Emulator not to the real ABC engine."</em>
            </p>
          </div>
          <div style="font-size: 13px; line-height: 1.6; margin-bottom: 16px;">
            <div><strong>Merchant Ref:</strong> <code>${data.order.merchantRefNum}</code></div>
            <div><strong>Fawry Ref:</strong> <code>${data.fawryRefNumber || 'Generated'}</code></div>
            <div><strong>Wallet Mobile:</strong> <code>${mobile}</code></div>
          </div>
          <a href="/orders/${data.order.merchantRefNum}" class="btn btn-primary btn-block">View Order Details</a>
        `,
        buttonText: 'Close & Refresh Table',
        onButtonClick: () => { hideModal(); location.reload(); }
      });
    } else {
      alert('Error: ' + (data.error || 'Failed to generate E-Wallet order'));
    }
  } catch (err) {
    toggleBtnLoading(btn, false);
    alert('Request failed: ' + err.message);
  }
}

// ------------------------------------------------------------
// 6. My Fawry App Test Case
// ------------------------------------------------------------
async function handleMyFawry(event) {
  event.preventDefault();
  const form = event.target;
  const btn = form.querySelector('button[type="submit"]');
  const amount = form.elements['amount'].value;
  const email = form.elements['email'].value;

  toggleBtnLoading(btn, true);

  try {
    const res = await fetch('/api/payment/create-myfawry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, email })
    });
    const data = await res.json();

    toggleBtnLoading(btn, false);

    if (data.success) {
      const qrImage = data.fawryResponse && data.fawryResponse.data && data.fawryResponse.data.paymentQr;
      const deepLink = data.fawryResponse && data.fawryResponse.data && data.fawryResponse.data.paymentDeepLink;

      showModal({
        title: 'My Fawry App Order Generated (Passed!)',
        bodyHtml: `
          <div style="background: rgba(139, 92, 246, 0.1); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 8px; padding: 14px; margin-bottom: 16px;">
            <div style="font-weight: 700; color: #a78bfa; margin-bottom: 4px;">✓ My Fawry App Test Case Passed!</div>
            <p style="font-size: 13px; color: var(--text-muted); line-height: 1.5;">
              As confirmed by Fawry Staging:
              <em>"Once you succeeded to generate the order, you passed the MyFawryApp test."</em>
            </p>
          </div>
          ${qrImage ? `
            <div style="text-align: center; margin-bottom: 14px;">
              <img src="${qrImage}" alt="QR" style="width: 140px; height: 140px; background: white; padding: 6px; border-radius: 8px; border: 1px solid var(--border-color);">
              <div style="font-size: 11px; color: var(--text-dim); margin-top: 4px;">Scan with myFawry App (or test emulator)</div>
            </div>
          ` : ''}
          <div style="font-size: 13px; line-height: 1.6; margin-bottom: 16px;">
            <div><strong>Merchant Ref:</strong> <code>${data.order.merchantRefNum}</code></div>
            <div><strong>Fawry Ref:</strong> <code>${data.fawryRefNumber || 'Generated'}</code></div>
          </div>
          <div style="display: flex; gap: 8px;">
            ${deepLink ? `<a href="${deepLink}" target="_blank" class="btn btn-secondary flex-1">Open Deep Link ↗</a>` : ''}
            <a href="/orders/${data.order.merchantRefNum}" class="btn btn-primary flex-1">View Order Details</a>
          </div>
        `,
        buttonText: 'Close & Refresh Table',
        onButtonClick: () => { hideModal(); location.reload(); }
      });
    } else {
      alert('Error: ' + (data.error || 'Failed to generate My Fawry order'));
    }
  } catch (err) {
    toggleBtnLoading(btn, false);
    alert('Request failed: ' + err.message);
  }
}

// ------------------------------------------------------------
// 7. Pull Model: Status Inquiry
// ------------------------------------------------------------
async function inquireOrderStatus(merchantRefNum, btn) {
  if (btn) toggleBtnLoading(btn, true);

  try {
    const res = await fetch(`/api/payment/status/${merchantRefNum}`);
    const data = await res.json();

    if (btn) toggleBtnLoading(btn, false);

    if (data.success) {
      const currentStatus = data.order ? data.order.orderStatus : 'UNKNOWN';
      showModal({
        title: `Status Inquiry for #${merchantRefNum}`,
        bodyHtml: `
          <div style="text-align: center; margin-bottom: 16px;">
            <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 4px;">Current System Status:</div>
            <span class="order-status-pill status-${currentStatus.toLowerCase()}" style="font-size: 14px; padding: 6px 14px;">
              ${currentStatus}
            </span>
          </div>
          <div class="code-card">
            <div class="code-card-header">Fawry API V2 Response:</div>
            <pre class="json-box"><code>${JSON.stringify(data.fawryStatus, null, 2)}</code></pre>
          </div>
        `,
        buttonText: 'OK',
        onButtonClick: () => { hideModal(); location.reload(); }
      });
    } else {
      alert('Inquiry failed: ' + (data.error || 'Unknown error'));
    }
  } catch (err) {
    if (btn) toggleBtnLoading(btn, false);
    alert('Status check failed: ' + err.message);
  }
}

async function triggerManualPull() {
  const btn = document.getElementById('btn-trigger-pull');
  toggleBtnLoading(btn, true);

  try {
    const res = await fetch('/api/payment/pull/trigger', { method: 'POST' });
    const data = await res.json();
    toggleBtnLoading(btn, false);

    alert(data.message || 'Pull job executed.');
    location.reload();
  } catch (err) {
    toggleBtnLoading(btn, false);
    alert('Failed to trigger pull job: ' + err.message);
  }
}

// ------------------------------------------------------------
// 8. Push Model: Webhook Simulation
// ------------------------------------------------------------
async function quickSimulateWebhook(merchantRefNumber, orderStatus) {
  try {
    const res = await fetch('/api/fawry/webhook/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchantRefNumber, orderStatus })
    });
    const data = await res.json();
    if (data.success) {
      showModal({
        title: `Webhook Push Simulated (${orderStatus})`,
        bodyHtml: `
          <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 12px; margin-bottom: 14px; font-size: 13px;">
            ✓ Dispatched valid Server Notification V2 payload for <strong>#${merchantRefNumber}</strong>. Order status set to <strong>${orderStatus}</strong>!
          </div>
          <pre class="json-box"><code>${JSON.stringify(data.payload, null, 2)}</code></pre>
        `,
        buttonText: 'Done & Refresh',
        onButtonClick: () => { hideModal(); location.reload(); }
      });
    } else {
      alert('Error: ' + data.error);
    }
  } catch (err) {
    alert('Simulation failed: ' + err.message);
  }
}

function simulateWebhookPrompt() {
  const ref = prompt('Enter merchantRefNumber to simulate webhook for:');
  if (ref) {
    const status = prompt('Enter status (PAID, EXPIRED, FAILED):', 'PAID');
    if (status) {
      quickSimulateWebhook(ref.trim(), status.trim().toUpperCase());
    }
  }
}

// ------------------------------------------------------------
// 9. Dedicated Test Case: Update order status using push model
// ------------------------------------------------------------
async function handlePushOrder(event) {
  event.preventDefault();
  const form = event.target;
  const btn = form.querySelector('button[type="submit"]');
  const amount = form.elements['amount'].value;
  const mobile = form.elements['mobile'].value;

  toggleBtnLoading(btn, true);

  try {
    const res = await fetch('/api/payment/create-push-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, mobile })
    });
    const data = await res.json();
    toggleBtnLoading(btn, false);

    if (data.success) {
      const refNum = data.fawryRefNumber;
      showModal({
        title: 'Push Model Test Order Created!',
        bodyHtml: `
          <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 14px; margin-bottom: 16px;">
            <div style="font-weight: 700; color: #34d399; margin-bottom: 4px;">Order #${data.order.merchantRefNum} Created for Push Model</div>
            <p style="font-size: 13px; color: var(--text-muted); line-height: 1.5;">
              Fawry Pay Reference Number: <strong class="code-font" style="color: var(--fawry-amber); font-size: 16px;">${refNum}</strong>
            </p>
          </div>

          <div style="background: rgba(255, 255, 255, 0.04); border-radius: 8px; padding: 14px; font-size: 13px; line-height: 1.6; margin-bottom: 16px;">
            <strong>To finalize this test case:</strong>
            <ol style="padding-left: 20px; margin-top: 6px;">
              <li>Pay reference number <code>${refNum}</code> at <a href="https://developer.fawrystaging.com/public/pay-order/" target="_blank" style="color: var(--fawry-amber);">Fawry Staging Portal ↗</a>.</li>
              <li>Fawry's server sends a live HTTP POST webhook to: <br><code style="font-size: 11px;">${data.webhookEndpoint}</code></li>
              <li>Your system verifies the SHA-256 signature, responds with HTTP 200, and updates the order status to <strong>PAID</strong>!</li>
            </ol>
          </div>

          <div style="display: flex; gap: 10px;">
            <a href="https://developer.fawrystaging.com/public/pay-order/" target="_blank" class="btn btn-primary" style="flex: 1;">Pay on Fawry Portal ↗</a>
            <button class="btn btn-outline" style="flex: 1;" onclick="dispatchLivePushTest(this, '${data.order.merchantRefNum}')">Dispatch Push Test Now</button>
          </div>
        `,
        buttonText: 'Close & Refresh Table',
        onButtonClick: () => { hideModal(); location.reload(); }
      });
    } else {
      alert('Error: ' + (data.error || 'Failed to create order'));
    }
  } catch (err) {
    toggleBtnLoading(btn, false);
    alert('Request failed: ' + err.message);
  }
}

async function dispatchLivePushTest(btn, merchantRefNum = null) {
  if (btn && btn.tagName === 'BUTTON') toggleBtnLoading(btn, true);

  try {
    const res = await fetch('/api/payment/dispatch-push-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchantRefNum })
    });
    const data = await res.json();
    if (btn && btn.tagName === 'BUTTON') toggleBtnLoading(btn, false);

    if (data.success) {
      showModal({
        title: 'Server Notification V2 Successfully Received!',
        bodyHtml: `
          <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 14px; margin-bottom: 16px; font-size: 13px;">
            <div style="font-weight: 700; color: #34d399; margin-bottom: 4px;">✓ Push Model Verified (HTTP 200 OK)</div>
            ${data.message}<br>
            Order <strong>#${data.order.merchantRefNum}</strong> updated to <strong>${data.order.orderStatus}</strong> via <code>WEBHOOK_PUSH</code>!
          </div>
          <pre class="json-box"><code>${JSON.stringify(data.payload, null, 2)}</code></pre>
        `,
        buttonText: 'Close & Refresh',
        onButtonClick: () => { hideModal(); location.reload(); }
      });
    } else {
      alert('Error dispatching push notification: ' + (data.error || 'Failed'));
    }
  } catch (err) {
    if (btn && btn.tagName === 'BUTTON') toggleBtnLoading(btn, false);
    alert('Failed to dispatch push notification: ' + err.message);
  }
}

// ============================================================
// QUICK 1-CLICK TEST CASE LAUNCHERS
// ============================================================

async function quickStartCard(scenario, btn) {
  toggleBtnLoading(btn, true);
  try {
    const res = await fetch('/api/payment/create-card', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: '100.00', scenario })
    });
    const data = await res.json();
    toggleBtnLoading(btn, false);

    if (data.success) {
      const isSuccess = scenario === 'SUCCESS';
      const cardNum = isSuccess ? '4508 7500 1574 1019' : '5078 0967 0005 3444';
      const cvv = '100';
      const exp = '01/39';
      const otp = '123456';

      showModal({
        title: `${scenario === 'SUCCESS' ? 'Success' : 'Declined'} Fawry Card Gateway Session`,
        bodyHtml: `
          <div style="margin-bottom: 16px;">
            <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 8px;">
              Copy the test card details below, then click <strong>Open Fawry Gateway</strong>:
            </div>
            <div style="background: ${isSuccess ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; border: 1px solid ${isSuccess ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}; border-radius: 8px; padding: 14px; font-family: var(--font-mono); font-size: 13px;">
              <div>Card Number: <strong style="cursor: pointer; color: #fff;" onclick="copyText('${cardNum.replace(/ /g, '')}', this)">${cardNum} 📋</strong></div>
              <div style="margin-top: 6px;">Exp: <strong>${exp}</strong> | CVV: <strong>${cvv}</strong> ${!isSuccess ? '| OTP: <strong>' + otp + '</strong>' : ''}</div>
              <div style="margin-top: 4px; font-size: 11px; color: var(--text-dim);">Holder: Fawry Test</div>
            </div>
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <a href="${data.paymentUrl}" target="_blank" rel="noopener" class="btn btn-primary" style="font-size: 14px; padding: 12px; text-align: center;">
              💳 Open Fawry Gateway (${isSuccess ? 'Expected: Paid' : 'Expected: Declined'}) ↗
            </a>
            <a href="/orders/${data.order.merchantRefNum}" class="btn btn-secondary" style="text-align: center;">View Order Details</a>
          </div>
        `,
        buttonText: 'Done & Refresh',
        onButtonClick: () => { hideModal(); refreshDashboard(); location.reload(); }
      });
      showToast('Card checkout session initiated!', 'success');
    } else {
      showToast('Error: ' + (data.error || 'Failed to start card session'), 'error');
    }
  } catch (err) {
    toggleBtnLoading(btn, false);
    showToast('Request failed: ' + err.message, 'error');
  }
}

async function quickStartWallet(btn) {
  toggleBtnLoading(btn, true);
  try {
    const res = await fetch('/api/payment/create-wallet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: '75.00', mobile: '01012345678' })
    });
    const data = await res.json();
    toggleBtnLoading(btn, false);

    if (data.success) {
      showModal({
        title: 'E-Wallet Order Verified (Passed!)',
        bodyHtml: `
          <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 14px; margin-bottom: 16px;">
            <div style="font-weight: 700; color: #34d399; margin-bottom: 4px;">✓ E-Wallet Test Case Verified!</div>
            <p style="font-size: 13px; color: var(--text-muted); line-height: 1.5;">
              As confirmed by Fawry Staging: Once you succeeded to generate the order, you passed the E-Wallet test.
            </p>
          </div>
          <div style="font-size: 13px; line-height: 1.8; margin-bottom: 16px;">
            <div><strong>Merchant Ref:</strong> <code>${data.order.merchantRefNum}</code></div>
            <div><strong>Fawry Ref:</strong> <code>${data.fawryRefNumber || 'Generated'}</code></div>
            <div><strong>Wallet Mobile:</strong> <code>01012345678</code></div>
          </div>
          <a href="/orders/${data.order.merchantRefNum}" class="btn btn-primary btn-block" style="text-align: center;">View Order Details</a>
        `,
        buttonText: 'Done & Refresh',
        onButtonClick: () => { hideModal(); refreshDashboard(); location.reload(); }
      });
      showToast('E-Wallet order verified!', 'success');
    } else {
      showToast('Error: ' + (data.error || 'Failed'), 'error');
    }
  } catch (err) {
    toggleBtnLoading(btn, false);
    showToast('Failed: ' + err.message, 'error');
  }
}

async function quickStartMyFawry(btn) {
  toggleBtnLoading(btn, true);
  try {
    const res = await fetch('/api/payment/create-myfawry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: '120.00', email: 'test@example.com' })
    });
    const data = await res.json();
    toggleBtnLoading(btn, false);

    if (data.success) {
      const qrImage = data.fawryResponse && data.fawryResponse.data && data.fawryResponse.data.paymentQr;
      const deepLink = data.fawryResponse && data.fawryResponse.data && data.fawryResponse.data.paymentDeepLink;

      showModal({
        title: 'MyFawryApp Order Verified (Passed!)',
        bodyHtml: `
          <div style="background: rgba(139, 92, 246, 0.1); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 8px; padding: 14px; margin-bottom: 16px;">
            <div style="font-weight: 700; color: #a78bfa; margin-bottom: 4px;">✓ MyFawryApp Test Case Verified!</div>
            <p style="font-size: 13px; color: var(--text-muted); line-height: 1.5;">
              MyFawryApp order generated with QR Code &amp; Deep Link. Staging test case is passed upon generation.
            </p>
          </div>
          ${qrImage ? `
            <div style="text-align: center; margin-bottom: 14px;">
              <img src="${qrImage}" alt="QR" style="width: 140px; height: 140px; background: white; padding: 6px; border-radius: 8px; border: 1px solid var(--border-color);">
              <div style="font-size: 11px; color: var(--text-dim); margin-top: 4px;">Scan with myFawry App emulator</div>
            </div>
          ` : ''}
          <div style="font-size: 13px; line-height: 1.8; margin-bottom: 16px;">
            <div><strong>Merchant Ref:</strong> <code>${data.order.merchantRefNum}</code></div>
            <div><strong>Fawry Ref:</strong> <code>${data.fawryRefNumber || 'Generated'}</code></div>
          </div>
          <div style="display: flex; gap: 8px;">
            ${deepLink ? `<a href="${deepLink}" target="_blank" class="btn btn-secondary flex-1" style="text-align: center;">Open Deep Link ↗</a>` : ''}
            <a href="/orders/${data.order.merchantRefNum}" class="btn btn-primary flex-1" style="text-align: center;">Order Details</a>
          </div>
        `,
        buttonText: 'Done & Refresh',
        onButtonClick: () => { hideModal(); refreshDashboard(); location.reload(); }
      });
      showToast('MyFawryApp order verified!', 'success');
    } else {
      showToast('Error: ' + (data.error || 'Failed'), 'error');
    }
  } catch (err) {
    toggleBtnLoading(btn, false);
    showToast('Failed: ' + err.message, 'error');
  }
}

async function quickCreatePushOrder(btn) {
  toggleBtnLoading(btn, true);
  try {
    const res = await fetch('/api/payment/create-push-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: '100.00', mobile: '01012345678' })
    });
    const data = await res.json();
    toggleBtnLoading(btn, false);

    if (data.success) {
      const refNum = data.fawryRefNumber;
      showModal({
        title: 'Push Model Test Order Ready',
        bodyHtml: `
          <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 14px; margin-bottom: 16px;">
            <div style="font-weight: 700; color: #34d399; margin-bottom: 4px;">Order #${data.order.merchantRefNum} Ready</div>
            <div style="font-size: 13px; color: var(--text-muted); margin-top: 6px;">
              Fawry Pay Reference: <strong class="code-font copy-target" style="color: var(--fawry-amber); font-size: 18px; cursor: pointer;" onclick="copyText('${refNum}', this)">${refNum} 📋</strong>
            </div>
          </div>
          <div style="background: rgba(255, 255, 255, 0.04); border-radius: 8px; padding: 14px; font-size: 13px; line-height: 1.6; margin-bottom: 16px;">
            <strong>Fulfill this test case via either option:</strong>
            <ol style="padding-left: 20px; margin-top: 6px;">
              <li><strong>Option A (Simulator):</strong> Pay <code>${refNum}</code> on Fawry Staging Portal. Fawry automatically sends the webhook.</li>
              <li><strong>Option B (Instant):</strong> Click "Dispatch Signed Webhook" below to verify endpoint and signature right now!</li>
            </ol>
          </div>
          <div style="display: flex; gap: 8px;">
            <a href="https://developer.fawrystaging.com/public/pay-order/" target="_blank" rel="noopener" class="btn btn-secondary flex-1" style="text-align: center;">Fawry Portal ↗</a>
            <button class="btn btn-primary flex-1" onclick="dispatchLivePushTest(this, '${data.order.merchantRefNum}')">Dispatch Signed Webhook</button>
          </div>
        `,
        buttonText: 'Done & Refresh',
        onButtonClick: () => { hideModal(); refreshDashboard(); location.reload(); }
      });
      showToast('Push model test order created!', 'success');
    } else {
      showToast('Error: ' + (data.error || 'Failed to create order'), 'error');
    }
  } catch (err) {
    toggleBtnLoading(btn, false);
    showToast('Failed: ' + err.message, 'error');
  }
}

// ============================================================
// UI/UX TAB FILTERING & TABLE SEARCH
// ============================================================

function switchCategory(category, btn) {
  const tabs = document.querySelectorAll('.tabs-list .tab-btn');
  tabs.forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');

  const cards = document.querySelectorAll('#test-cards-container .test-card');
  cards.forEach(card => {
    const cardCat = card.getAttribute('data-category');
    if (category === 'ALL' || cardCat === category) {
      card.style.display = '';
    } else {
      card.style.display = 'none';
    }
  });
}

function filterTable(status, btn) {
  const filterBtns = document.querySelectorAll('.table-filter-pills .t-filter');
  filterBtns.forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  const rows = document.querySelectorAll('#orders-data-table tbody .order-row');
  let visibleCount = 0;
  rows.forEach(row => {
    const rowStatus = row.getAttribute('data-status');
    const matches = status === 'ALL' || rowStatus === status;
    row.style.display = matches ? '' : 'none';
    if (matches) visibleCount++;
  });

  const countElem = document.getElementById('orders-count');
  if (countElem) countElem.innerText = visibleCount;
}

function searchOrdersTable(query) {
  const term = (query || '').toLowerCase().trim();
  const rows = document.querySelectorAll('#orders-data-table tbody .order-row');
  let visibleCount = 0;
  rows.forEach(row => {
    const searchData = (row.getAttribute('data-search') || '').toLowerCase();
    const matches = !term || searchData.includes(term);
    row.style.display = matches ? '' : 'none';
    if (matches) visibleCount++;
  });
  const countElem = document.getElementById('orders-count');
  if (countElem) countElem.innerText = visibleCount;
}

// ============================================================
// REAL-TIME DASHBOARD AUTO-POLLING
// ============================================================

let lastWebhookCount = null;

async function refreshDashboard() {
  try {
    const res = await fetch('/api/dashboard/status');
    if (!res.ok) return;
    const data = await res.json();

    // 1. Update progress bar & percent
    if (data.testCasesStatus) {
      const keys = ['paidRefNumber', 'expiredRefNumber', 'creditCardSuccess', 'creditCardFailed', 'eWallet', 'myFawryApp', 'webhookPush', 'pullModel'];
      const passed = keys.filter(k => data.testCasesStatus[k]).length;
      const total = keys.length;
      const pct = Math.round((passed / total) * 100);

      const pctText = document.getElementById('progress-percent-text');
      const fillBar = document.getElementById('progress-fill-bar');
      if (pctText) pctText.innerHTML = `<strong>${passed}</strong> of ${total} Verified (${pct}%)`;
      if (fillBar) fillBar.style.width = `${pct}%`;
    }

    // 2. Update quick statistics counters
    if (data.stats) {
      const statMap = {
        'Total Orders': data.stats.totalOrders,
        '✓ Paid': data.stats.paidOrders,
        '⏳ Pending': data.stats.unpaidOrders,
        '⏰ Expired': data.stats.expiredOrders,
        '✕ Failed': data.stats.failedOrders,
        '🔔 Webhooks': data.stats.totalWebhooks
      };
      document.querySelectorAll('.quick-stats-row .q-stat').forEach(stat => {
        const label = stat.querySelector('.q-label')?.innerText?.trim();
        const valElem = stat.querySelector('.q-val');
        if (label && statMap[label] !== undefined && valElem) {
          valElem.innerText = statMap[label];
        }
      });

      // Notify if new webhook arrived
      if (lastWebhookCount !== null && data.stats.totalWebhooks > lastWebhookCount) {
        showToast('New Fawry Server Notification V2 received!', 'success');
      }
      lastWebhookCount = data.stats.totalWebhooks;
    }

    // 3. Update Pull last run timestamp
    if (data.pullStats && data.pullStats.lastRun) {
      const pullElem = document.getElementById('pull-last-run');
      if (pullElem) pullElem.innerText = new Date(data.pullStats.lastRun).toLocaleTimeString();
    }
  } catch (err) {
    // Non-blocking background catch
  }
}

// Poll every 5 seconds for real-time status updates
setInterval(refreshDashboard, 5000);


