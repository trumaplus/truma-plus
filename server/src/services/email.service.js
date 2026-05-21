const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

function formatCurrency(amount, currency = 'CAD') {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency }).format(amount);
}

function buildReceiptHtml(donation, synagogue) {
  const donorName = [donation.donorFirstName, donation.donorLastName].filter(Boolean).join(' ') || 'Valued Donor';
  const date = new Date(donation.createdAt).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,.1); }
    .header { background: #07131a; color: #ffd166; padding: 32px; text-align: center; }
    .header h1 { margin: 0; font-size: 26px; font-family: Georgia, serif; }
    .header p { margin: 8px 0 0; color: rgba(255,255,255,0.7); font-size: 14px; }
    .body { padding: 32px; color: #1a1a2a; }
    .amount { font-size: 40px; font-weight: 700; color: #07131a; margin: 16px 0; }
    .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; font-size: 15px; }
    .detail-label { color: #666; }
    .detail-value { font-weight: 600; }
    .tax-note { background: #f0f7f0; border-left: 4px solid #22c55e; padding: 14px 18px; margin-top: 24px; border-radius: 4px; font-size: 14px; color: #166534; }
    .footer { background: #f8f9fa; padding: 20px 32px; text-align: center; font-size: 13px; color: #888; }
    .logo { max-height: 60px; margin-bottom: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      ${synagogue.logoUrl ? `<img src="${synagogue.logoUrl}" alt="Logo" class="logo">` : ''}
      <h1>${synagogue.synagogueName}</h1>
      <p>Official Donation Receipt</p>
    </div>
    <div class="body">
      <p>Dear ${donorName},</p>
      <p>Thank you for your generous donation. Your contribution makes a real difference.</p>
      <div class="amount">${formatCurrency(donation.amount, donation.currency)}</div>
      <div class="detail-row">
        <span class="detail-label">Donation Type</span>
        <span class="detail-value">${donation.donationType.charAt(0).toUpperCase() + donation.donationType.slice(1)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Date</span>
        <span class="detail-value">${date}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Transaction ID</span>
        <span class="detail-value">${donation.transactionId || donation.id}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Organization</span>
        <span class="detail-value">${synagogue.synagogueName}${synagogue.city ? `, ${synagogue.city}` : ''}</span>
      </div>
      <div class="tax-note">
        ✓ This donation is eligible for tax purposes. Please retain this receipt for your records.
      </div>
    </div>
    <div class="footer">
      <p>${synagogue.synagogueName} &bull; Powered by Donation Plus</p>
    </div>
  </div>
</body>
</html>`;
}

async function sendReceiptEmail(donation, synagogue) {
  if (!donation.donorEmail) return;
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 're_placeholder') {
    console.log(`[Email] Would send receipt to ${donation.donorEmail} for $${donation.amount}`);
    return;
  }

  const donorName = [donation.donorFirstName, donation.donorLastName].filter(Boolean).join(' ') || 'Donor';

  await resend.emails.send({
    from: 'Donation Plus <receipts@donationplus.com>',
    to: donation.donorEmail,
    subject: `Donation Receipt — ${synagogue.synagogueName}`,
    html: buildReceiptHtml(donation, synagogue),
  });
}

module.exports = { sendReceiptEmail };
