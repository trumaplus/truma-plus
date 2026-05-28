const { Resend } = require('resend');

// ─── Configuration ────────────────────────────────────────────────────────────

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

const isConfigured = () =>
  process.env.RESEND_API_KEY &&
  process.env.RESEND_API_KEY !== 're_placeholder';

// Platform logo hosted on Railway — used inside email HTML
const PLATFORM_LOGO_URL = 'https://truma-plus-production.up.railway.app/logo.png';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount, currency = 'CAD') {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency }).format(amount);
}

const DONATION_TYPE_LABELS = {
  general: { en: 'General Donation', he: 'תרומה כללית' },
  neder:   { en: 'Neder',            he: 'נדר'          },
  aliyot:  { en: 'Aliyot',           he: 'עליות'        },
  kiddush: { en: 'Kiddush',          he: 'קידוש'        },
  standing:{ en: 'Standing Donation',he: 'תרומה קבועה'  },
  yizkor:  { en: 'Yizkor',           he: 'יזכור'        },
  coffee:  { en: 'Coffee Fund',      he: 'קרן קפה'      },
  seuda:   { en: 'Seuda',            he: 'סעודה'        },
};

function getTypeLabel(donationType) {
  const entry = DONATION_TYPE_LABELS[donationType];
  if (!entry) {
    const cap = donationType.charAt(0).toUpperCase() + donationType.slice(1);
    return { en: cap, he: cap };
  }
  return entry;
}

// ─── HTML Builder ─────────────────────────────────────────────────────────────

function buildReceiptHtml(donation, synagogue) {
  const donorName = [donation.donorFirstName, donation.donorLastName]
    .filter(Boolean).join(' ') || 'Valued Donor';

  const date = new Date(donation.createdAt).toLocaleDateString('en-CA', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const typeLabel = getTypeLabel(donation.donationType);
  const txId      = donation.transactionId || donation.id;
  const amount    = formatCurrency(donation.amount, donation.currency);

  // Synagogue logo row (optional)
  const synagogueLogo = synagogue.logoUrl
    ? `<img src="${synagogue.logoUrl}" alt="${synagogue.synagogueName}"
            style="height:56px;width:56px;border-radius:12px;object-fit:cover;
                   margin-bottom:16px;border:2px solid rgba(255,209,102,0.3);" /><br>`
    : '';

  // City line
  const location = synagogue.city
    ? `${synagogue.synagogueName} · ${synagogue.city}`
    : synagogue.synagogueName;

  return `<!DOCTYPE html>
<html lang="he" dir="auto">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>תודה על תרומתך — ${synagogue.synagogueName}</title>
</head>
<body style="margin:0;padding:0;background:#eef0f5;font-family:'Helvetica Neue',Arial,sans-serif;-webkit-text-size-adjust:100%;">

  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">

    <!-- ═══ OUTER CARD ═══ -->
    <div style="border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,.18);">

      <!-- ── TOP BAR: Truma Plus branding ── -->
      <div style="background:#07131a;padding:14px 28px;display:flex;align-items:center;justify-content:space-between;">
        <img src="${PLATFORM_LOGO_URL}" alt="Truma Plus"
             style="height:30px;object-fit:contain;" />
        <span style="color:#ffd166;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;
                     font-family:Georgia,'Times New Roman',serif;">Truma Plus</span>
      </div>

      <!-- ── HERO: Thank-you heading ── -->
      <div style="background:linear-gradient(150deg,#07131a 0%,#0d2a3f 60%,#07131a 100%);
                  padding:44px 32px 36px;text-align:center;">
        ${synagogueLogo}

        <!-- Hebrew main heading -->
        <div style="font-size:38px;color:#ffd166;font-family:Georgia,'Times New Roman',serif;
                    direction:rtl;line-height:1.2;margin-bottom:6px;">
          תודה על תרומתך!
        </div>

        <!-- English subtitle -->
        <div style="font-size:15px;color:rgba(255,255,255,0.65);margin-bottom:12px;
                    letter-spacing:0.3px;">
          Thank You for Your Generous Donation
        </div>

        <!-- Synagogue name -->
        <div style="display:inline-block;background:rgba(255,209,102,0.12);
                    border:1px solid rgba(255,209,102,0.25);border-radius:20px;
                    padding:5px 16px;font-size:13px;color:rgba(255,209,102,0.8);">
          ${location}
        </div>
      </div>

      <!-- ── WHITE BODY ── -->
      <div style="background:#fff;padding:36px 32px;">

        <!-- Greeting -->
        <p style="font-size:16px;color:#1a1a2a;margin:0 0 4px;">
          שלום ${donorName} / Dear ${donorName},
        </p>
        <p style="font-size:14px;color:#666;line-height:1.65;margin:0 0 28px;">
          תרומתך לקהילת <strong style="color:#1a1a2a;">${synagogue.synagogueName}</strong>
          התקבלה בהצלחה. תודה רבה על נדיבותך.<br />
          <span style="color:#aaa;font-size:13px;">
            Your donation to ${synagogue.synagogueName} has been received. We are grateful for your support.
          </span>
        </p>

        <!-- ── AMOUNT BOX ── -->
        <div style="background:#f7f8ff;border:2px solid #07131a;border-radius:14px;
                    padding:22px 28px;margin-bottom:28px;">
          <div style="font-size:11px;color:#999;text-transform:uppercase;
                      letter-spacing:0.8px;margin-bottom:6px;">
            סכום התרומה &nbsp;/&nbsp; Amount Donated
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <span style="font-size:44px;font-weight:800;color:#07131a;
                         letter-spacing:-1.5px;line-height:1;">
              ${amount}
            </span>
            <span style="width:48px;height:48px;background:#07131a;border-radius:12px;
                         display:inline-flex;align-items:center;justify-content:center;
                         font-size:22px;color:#ffd166;font-weight:bold;">
              ✓
            </span>
          </div>
        </div>

        <!-- ── DETAILS TABLE ── -->
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
          <tr style="border-bottom:1px solid #eee;">
            <td style="padding:12px 4px;font-size:14px;color:#999;width:48%;">
              סוג תרומה&nbsp;/&nbsp;Type
            </td>
            <td style="padding:12px 4px;font-size:14px;font-weight:600;
                       color:#1a1a2a;text-align:right;">
              ${typeLabel.he}&nbsp;·&nbsp;${typeLabel.en}
            </td>
          </tr>
          <tr style="border-bottom:1px solid #eee;">
            <td style="padding:12px 4px;font-size:14px;color:#999;">
              תאריך&nbsp;/&nbsp;Date
            </td>
            <td style="padding:12px 4px;font-size:14px;font-weight:600;
                       color:#1a1a2a;text-align:right;">
              ${date}
            </td>
          </tr>
          <tr style="border-bottom:1px solid #eee;">
            <td style="padding:12px 4px;font-size:14px;color:#999;">
              בית כנסת&nbsp;/&nbsp;Synagogue
            </td>
            <td style="padding:12px 4px;font-size:14px;font-weight:600;
                       color:#1a1a2a;text-align:right;">
              ${synagogue.synagogueName}
            </td>
          </tr>
          <tr>
            <td style="padding:12px 4px;font-size:14px;color:#999;">
              מספר עסקה&nbsp;/&nbsp;Transaction ID
            </td>
            <td style="padding:12px 4px;font-size:12px;font-family:monospace;
                       color:#888;text-align:right;word-break:break-all;">
              ${txId}
            </td>
          </tr>
        </table>

        <!-- ── TAX CERTIFICATE ── -->
        <div style="background:#f0fdf4;border-left:4px solid #22c55e;
                    border-radius:6px;padding:16px 20px;line-height:1.6;">
          <div style="font-size:14px;color:#15803d;font-weight:700;
                      margin-bottom:4px;direction:rtl;">
            ✓&nbsp;&nbsp;תרומתך מוכרת לצרכי מס.
          </div>
          <div style="font-size:13px;color:#166534;margin-bottom:4px;">
            קבלה זו מהווה אישור רשמי לניכוי מס. אנא שמור/י אותה לתיעוד.
          </div>
          <div style="font-size:12px;color:#16a34a;opacity:0.75;">
            Your donation is tax-deductible. Please retain this receipt for your records.
          </div>
        </div>

      </div><!-- /body -->

      <!-- ── FOOTER ── -->
      <div style="background:#07131a;padding:24px 32px;text-align:center;
                  border-top:1px solid rgba(255,255,255,0.05);">
        <img src="${PLATFORM_LOGO_URL}" alt="Truma Plus"
             style="height:22px;object-fit:contain;opacity:0.45;margin-bottom:10px;" /><br />
        <p style="margin:0;color:rgba(255,255,255,0.25);font-size:12px;line-height:1.7;">
          <a href="https://truma-plus-production.up.railway.app"
             style="color:rgba(255,209,102,0.4);text-decoration:none;">Truma Plus</a>
          &nbsp;·&nbsp; ${synagogue.synagogueName}
          ${synagogue.city ? `&nbsp;·&nbsp; ${synagogue.city}` : ''}
        </p>
        <p style="margin:8px 0 0;color:rgba(255,255,255,0.12);font-size:11px;line-height:1.6;">
          לשאלות בנוגע לתרומה, פנה/י ישירות לבית הכנסת.<br />
          For questions about your donation, please contact the synagogue directly.
        </p>
      </div>

    </div><!-- /card -->

    <!-- Bottom spacer -->
    <div style="height:24px;"></div>

  </div>
</body>
</html>`;
}

// ─── Send ─────────────────────────────────────────────────────────────────────

async function sendReceiptEmail(donation, synagogue) {
  // Guard: no email address
  if (!donation.donorEmail) return;

  // Guard: Resend not configured
  if (!isConfigured()) {
    const amount = formatCurrency(donation.amount, donation.currency);
    console.log(
      `[Email] RESEND_API_KEY not set — would send receipt to ${donation.donorEmail}` +
      ` for ${amount} (${donation.donationType})`
    );
    return;
  }

  const resend = getResend();

  // Sender address:
  //   Production → RESEND_FROM_EMAIL (e.g. donations@trumaplus.com after domain verification)
  //   Dev/fallback → Resend sandbox sender (only delivers to your own verified email)
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  const fromName  = 'Truma Plus Receipts';

  const donorName  = [donation.donorFirstName, donation.donorLastName]
    .filter(Boolean).join(' ') || 'Donor';
  const amount     = formatCurrency(donation.amount, donation.currency);
  const typeLabels = getTypeLabel(donation.donationType);

  const subject = `✓ קבלת תרומה / Donation Receipt — ${synagogue.synagogueName} (${amount})`;

  const result = await resend.emails.send({
    from:    `${fromName} <${fromEmail}>`,
    to:      donation.donorEmail,
    subject,
    html:    buildReceiptHtml(donation, synagogue),
    tags: [
      { name: 'synagogue', value: (synagogue.synagogueCode || synagogue.id).slice(0, 35) },
      { name: 'donation',  value: donation.id.slice(0, 35) },
      { name: 'type',      value: donation.donationType },
    ],
  });

  console.log(
    `[Email] Receipt sent → ${donation.donorEmail}` +
    ` | ${amount} | ${typeLabels.en} | id=${result.data?.id ?? result}`
  );
  return result;
}

module.exports = { sendReceiptEmail };
