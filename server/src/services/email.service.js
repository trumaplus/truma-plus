const { Resend } = require('resend');

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

const isConfigured = () =>
  process.env.RESEND_API_KEY &&
  process.env.RESEND_API_KEY !== 're_placeholder';

function formatCurrency(amount, currency = 'CAD') {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency }).format(amount);
}

const DONATION_TYPE_LABELS = {
  general: 'General Donation',
  neder:   'Neder',
  aliyot:  'Aliyot',
  kiddush: 'Kiddush',
  standing:'Standing Donation',
  yizkor:  'Yizkor',
  coffee:  'Coffee Fund',
  seuda:   'Seuda',
};

function buildReceiptHtml(donation, synagogue) {
  const donorName = [donation.donorFirstName, donation.donorLastName]
    .filter(Boolean).join(' ') || 'Valued Donor';

  const date = new Date(donation.createdAt).toLocaleDateString('en-CA', {
    year:  'numeric',
    month: 'long',
    day:   'numeric',
  });

  const typeLabel = DONATION_TYPE_LABELS[donation.donationType] ||
    donation.donationType.charAt(0).toUpperCase() + donation.donationType.slice(1);

  const txId = donation.transactionId || donation.id;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Donation Receipt — ${synagogue.synagogueName}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      background: #f0f2f5;
      margin: 0;
      padding: 24px 16px;
      color: #1a1a2a;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: #fff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 32px rgba(0,0,0,.12);
    }
    .header {
      background: #07131a;
      color: #ffd166;
      padding: 36px 32px;
      text-align: center;
    }
    .logo {
      max-height: 64px;
      max-width: 180px;
      margin-bottom: 16px;
      border-radius: 8px;
    }
    .header h1 {
      margin: 0 0 4px;
      font-size: 24px;
      font-family: Georgia, 'Times New Roman', serif;
      color: #ffd166;
    }
    .header p {
      margin: 0;
      color: rgba(255,255,255,.55);
      font-size: 13px;
      letter-spacing: .5px;
      text-transform: uppercase;
    }
    .body { padding: 36px 32px; }
    .greeting { font-size: 16px; margin-bottom: 6px; }
    .thank-you { color: #555; font-size: 15px; margin-bottom: 28px; }
    .amount-box {
      background: #f8f9ff;
      border: 2px solid #07131a;
      border-radius: 12px;
      padding: 20px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 28px;
    }
    .amount-label { font-size: 13px; color: #888; text-transform: uppercase; letter-spacing: .4px; }
    .amount-value { font-size: 38px; font-weight: 800; color: #07131a; letter-spacing: -1px; }
    .detail-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    .detail-table tr { border-bottom: 1px solid #eee; }
    .detail-table tr:last-child { border-bottom: none; }
    .detail-table td { padding: 12px 4px; font-size: 14px; }
    .detail-table .label { color: #888; width: 45%; }
    .detail-table .value { font-weight: 600; text-align: right; }
    .tax-note {
      background: #f0fdf4;
      border-left: 4px solid #22c55e;
      border-radius: 4px;
      padding: 14px 18px;
      font-size: 13px;
      color: #15803d;
      line-height: 1.5;
    }
    .footer {
      background: #f8f9fa;
      border-top: 1px solid #eee;
      padding: 20px 32px;
      text-align: center;
      font-size: 12px;
      color: #aaa;
      line-height: 1.6;
    }
    .footer a { color: #888; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      ${synagogue.logoUrl ? `<img src="${synagogue.logoUrl}" alt="${synagogue.synagogueName} Logo" class="logo"><br>` : ''}
      <h1>${synagogue.synagogueName}</h1>
      <p>Official Donation Receipt</p>
    </div>

    <div class="body">
      <p class="greeting">Dear ${donorName},</p>
      <p class="thank-you">
        Thank you for your generous donation. Your contribution makes a meaningful
        difference to our community.
      </p>

      <div class="amount-box">
        <span class="amount-label">Amount Donated</span>
        <span class="amount-value">${formatCurrency(donation.amount, donation.currency)}</span>
      </div>

      <table class="detail-table">
        <tr>
          <td class="label">Donation Type</td>
          <td class="value">${typeLabel}</td>
        </tr>
        <tr>
          <td class="label">Date</td>
          <td class="value">${date}</td>
        </tr>
        <tr>
          <td class="label">Organization</td>
          <td class="value">${synagogue.synagogueName}${synagogue.city ? `, ${synagogue.city}` : ''}</td>
        </tr>
        <tr>
          <td class="label">Transaction ID</td>
          <td class="value" style="font-family: monospace; font-size: 12px;">${txId}</td>
        </tr>
      </table>

      <div class="tax-note">
        ✓ &nbsp;This receipt may be used for tax purposes.
        Please retain it for your records.
      </div>
    </div>

    <div class="footer">
      <p>
        <strong>${synagogue.synagogueName}</strong><br>
        Powered by <a href="https://truma-plus-production.up.railway.app">Truma Plus</a>
      </p>
      <p style="margin-top:8px; font-size:11px; color:#ccc;">
        If you have questions about your donation, please contact the synagogue directly.
      </p>
    </div>
  </div>
</body>
</html>`;
}

async function sendReceiptEmail(donation, synagogue) {
  if (!donation.donorEmail) return;

  if (!isConfigured()) {
    console.log(
      `[Email] RESEND_API_KEY not configured — would send receipt to ${donation.donorEmail}` +
      ` for ${formatCurrency(donation.amount, donation.currency)}`
    );
    return;
  }

  const resend = getResend();

  // Use verified domain from env, fall back to Resend's sandbox sender
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  const fromName  = 'Truma Plus Receipts';

  const donorName = [donation.donorFirstName, donation.donorLastName]
    .filter(Boolean).join(' ') || 'Donor';

  const result = await resend.emails.send({
    from:    `${fromName} <${fromEmail}>`,
    to:      donation.donorEmail,
    subject: `Donation Receipt — ${synagogue.synagogueName} (${formatCurrency(donation.amount, donation.currency)})`,
    html:    buildReceiptHtml(donation, synagogue),
    tags: [
      { name: 'synagogue', value: synagogue.synagogueCode || synagogue.id },
      { name: 'donation',  value: donation.id },
    ],
  });

  console.log(`[Email] Receipt sent to ${donation.donorEmail}:`, result.id || result);
  return result;
}

module.exports = { sendReceiptEmail };
