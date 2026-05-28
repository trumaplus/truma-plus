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

// ─── Translations ─────────────────────────────────────────────────────────────

const T = {
  en: {
    dir:            'ltr',
    locale:         'en-CA',
    subject:        (synagogue, amount) => `✓ Donation Receipt — ${synagogue} (${amount})`,
    title:          'Thank You for Your Donation!',
    subtitle:       'Thank You for Your Generous Donation',
    greeting:       (name) => `Dear ${name},`,
    body:           (synagogue) =>
      `Your donation to <strong style="color:#1a1a2a;">${synagogue}</strong> has been received successfully. We are deeply grateful for your generosity and support.`,
    amountLabel:    'Amount Donated',
    typeLabel:      'Donation Type',
    dateLabel:      'Date',
    synagogueLabel: 'Synagogue',
    txLabel:        'Transaction ID',
    taxHeading:     '✓  Your donation is tax-deductible.',
    taxBody:        'This receipt serves as official documentation for tax deduction purposes.',
    taxNote:        'Please retain this receipt for your records.',
    footerNote:     'For questions about your donation, please contact the synagogue directly.',
  },
  he: {
    dir:            'rtl',
    locale:         'he-IL',
    subject:        (synagogue, amount) => `✓ קבלת תרומה — ${synagogue} (${amount})`,
    title:          'תודה על תרומתך!',
    subtitle:       'תודה על נדיבותך',
    greeting:       (name) => `שלום ${name},`,
    body:           (synagogue) =>
      `תרומתך לקהילת <strong style="color:#1a1a2a;">${synagogue}</strong> התקבלה בהצלחה. תודה רבה על נדיבותך ותמיכתך.`,
    amountLabel:    'סכום התרומה',
    typeLabel:      'סוג תרומה',
    dateLabel:      'תאריך',
    synagogueLabel: 'בית כנסת',
    txLabel:        'מספר עסקה',
    taxHeading:     '✓  תרומתך מוכרת לצרכי מס.',
    taxBody:        'קבלה זו מהווה אישור רשמי לניכוי מס.',
    taxNote:        'אנא שמור/י קבלה זו לתיעוד.',
    footerNote:     'לשאלות בנוגע לתרומה, פנה/י ישירות לבית הכנסת.',
  },
  fr: {
    dir:            'ltr',
    locale:         'fr-CA',
    subject:        (synagogue, amount) => `✓ Reçu de don — ${synagogue} (${amount})`,
    title:          'Merci pour votre don !',
    subtitle:       'Merci pour votre généreuse contribution',
    greeting:       (name) => `Cher/Chère ${name},`,
    body:           (synagogue) =>
      `Votre don à <strong style="color:#1a1a2a;">${synagogue}</strong> a bien été reçu. Nous vous remercions chaleureusement de votre soutien.`,
    amountLabel:    'Montant du don',
    typeLabel:      'Type de don',
    dateLabel:      'Date',
    synagogueLabel: 'Synagogue',
    txLabel:        'Numéro de transaction',
    taxHeading:     '✓  Votre don est déductible des impôts.',
    taxBody:        'Ce reçu constitue une preuve officielle de déduction fiscale.',
    taxNote:        'Veuillez conserver ce reçu pour vos dossiers.',
    footerNote:     'Pour toute question concernant votre don, veuillez contacter la synagogue directement.',
  },
  yi: {
    dir:            'rtl',
    locale:         'he-IL',
    subject:        (synagogue, amount) => `✓ קבלה פאַר נדבה — ${synagogue} (${amount})`,
    title:          'אַ דאַנק פאַר דיין נדבה!',
    subtitle:       'אַ גרויסן דאַנק פאַר דיין נדיבות',
    greeting:       (name) => `שלום ${name},`,
    body:           (synagogue) =>
      `דיין נדבה צו <strong style="color:#1a1a2a;">${synagogue}</strong> איז אנגענומען געוואָרן. אַ גרויסן דאַנק פאַר דיין נדיבות.`,
    amountLabel:    'סומע פון נדבה',
    typeLabel:      'סאָרט נדבה',
    dateLabel:      'דאַטע',
    synagogueLabel: 'שיל',
    txLabel:        'טראַנזאַקציע נומער',
    taxHeading:     '✓  דיין נדבה איז שטייַעראַ-אָפּציִאַל.',
    taxBody:        'דאָזע קבלה איז אָפיציעלע דאָקומענטאַציע פאַר שטייַעראַ-אָפּצוג.',
    taxNote:        'ביטע האַלט דאָזע קבלה פאַר דיינע רעקאָרדן.',
    footerNote:     'פאַר פראגן וועגן דיין נדבה, ביטע ווענדט זיך צו דער שיל אַליין.',
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount, currency = 'CAD') {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency }).format(amount);
}

const DONATION_TYPE_LABELS = {
  general: { en: 'General Donation', he: 'תרומה כללית', fr: 'Don général',    yi: 'אַלגעמיינע נדבה' },
  neder:   { en: 'Neder',            he: 'נדר',          fr: 'Vœu',            yi: 'נדר'              },
  aliyot:  { en: 'Aliyot',           he: 'עליות',        fr: 'Aliyot',         yi: 'עליות'            },
  kiddush: { en: 'Kiddush',          he: 'קידוש',        fr: 'Kiddouch',       yi: 'קידוש'            },
  standing:{ en: 'Standing Donation',he: 'תרומה קבועה',  fr: 'Don régulier',   yi: 'שטענדיקע נדבה'   },
  yizkor:  { en: 'Yizkor',           he: 'יזכור',        fr: 'Yizkor',         yi: 'יזכור'            },
  coffee:  { en: 'Coffee Fund',      he: 'קרן קפה',      fr: 'Fonds café',     yi: 'קאַווע פאָנד'     },
  seuda:   { en: 'Seuda',            he: 'סעודה',        fr: 'Seuda',          yi: 'סעודה'            },
};

function getTypeLabel(donationType, lang = 'en') {
  const entry = DONATION_TYPE_LABELS[donationType];
  if (!entry) {
    const cap = donationType.charAt(0).toUpperCase() + donationType.slice(1);
    return cap;
  }
  return entry[lang] || entry.en;
}

// ─── HTML Builder ─────────────────────────────────────────────────────────────

function buildReceiptHtml(donation, synagogue, lang = 'en') {
  const t = T[lang] || T.en;

  const donorName = [donation.donorFirstName, donation.donorLastName]
    .filter(Boolean).join(' ') || (lang === 'he' ? 'תורם יקר' : lang === 'yi' ? 'יקירער נדבן' : lang === 'fr' ? 'Cher Donateur' : 'Valued Donor');

  const date = new Date(donation.createdAt).toLocaleDateString(t.locale, {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const typeLabelText = getTypeLabel(donation.donationType, lang);
  const txId          = donation.transactionId || donation.id;
  const amount        = formatCurrency(donation.amount, donation.currency);

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

  const isRtl     = t.dir === 'rtl';
  const textAlign = isRtl ? 'right' : 'left';

  return `<!DOCTYPE html>
<html lang="${lang}" dir="${t.dir}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${t.subject(synagogue.synagogueName, amount)}</title>
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

        <!-- Main heading -->
        <div style="font-size:36px;color:#ffd166;font-family:Georgia,'Times New Roman',serif;
                    direction:${t.dir};line-height:1.2;margin-bottom:6px;">
          ${t.title}
        </div>

        <!-- Subtitle -->
        <div style="font-size:15px;color:rgba(255,255,255,0.65);margin-bottom:12px;
                    letter-spacing:0.3px;direction:${t.dir};">
          ${t.subtitle}
        </div>

        <!-- Synagogue name badge -->
        <div style="display:inline-block;background:rgba(255,209,102,0.12);
                    border:1px solid rgba(255,209,102,0.25);border-radius:20px;
                    padding:5px 16px;font-size:13px;color:rgba(255,209,102,0.8);">
          ${location}
        </div>
      </div>

      <!-- ── WHITE BODY ── -->
      <div style="background:#fff;padding:36px 32px;direction:${t.dir};">

        <!-- Greeting -->
        <p style="font-size:16px;color:#1a1a2a;margin:0 0 4px;text-align:${textAlign};">
          ${t.greeting(donorName)}
        </p>
        <p style="font-size:14px;color:#666;line-height:1.65;margin:0 0 28px;text-align:${textAlign};">
          ${t.body(synagogue.synagogueName)}
        </p>

        <!-- ── AMOUNT BOX ── -->
        <div style="background:#f7f8ff;border:2px solid #07131a;border-radius:14px;
                    padding:22px 28px;margin-bottom:28px;">
          <div style="font-size:11px;color:#999;text-transform:uppercase;
                      letter-spacing:0.8px;margin-bottom:6px;text-align:${textAlign};">
            ${t.amountLabel}
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;flex-direction:${isRtl ? 'row-reverse' : 'row'};">
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
            <td style="padding:12px 4px;font-size:14px;color:#999;width:48%;text-align:${textAlign};">
              ${t.typeLabel}
            </td>
            <td style="padding:12px 4px;font-size:14px;font-weight:600;
                       color:#1a1a2a;text-align:${isRtl ? 'left' : 'right'};">
              ${typeLabelText}
            </td>
          </tr>
          <tr style="border-bottom:1px solid #eee;">
            <td style="padding:12px 4px;font-size:14px;color:#999;text-align:${textAlign};">
              ${t.dateLabel}
            </td>
            <td style="padding:12px 4px;font-size:14px;font-weight:600;
                       color:#1a1a2a;text-align:${isRtl ? 'left' : 'right'};">
              ${date}
            </td>
          </tr>
          <tr style="border-bottom:1px solid #eee;">
            <td style="padding:12px 4px;font-size:14px;color:#999;text-align:${textAlign};">
              ${t.synagogueLabel}
            </td>
            <td style="padding:12px 4px;font-size:14px;font-weight:600;
                       color:#1a1a2a;text-align:${isRtl ? 'left' : 'right'};">
              ${synagogue.synagogueName}
            </td>
          </tr>
          <tr>
            <td style="padding:12px 4px;font-size:14px;color:#999;text-align:${textAlign};">
              ${t.txLabel}
            </td>
            <td style="padding:12px 4px;font-size:12px;font-family:monospace;
                       color:#888;text-align:${isRtl ? 'left' : 'right'};word-break:break-all;">
              ${txId}
            </td>
          </tr>
        </table>

        <!-- ── TAX CERTIFICATE ── -->
        <div style="background:#f0fdf4;border-${isRtl ? 'right' : 'left'}:4px solid #22c55e;
                    border-radius:6px;padding:16px 20px;line-height:1.6;text-align:${textAlign};">
          <div style="font-size:14px;color:#15803d;font-weight:700;margin-bottom:4px;">
            ${t.taxHeading}
          </div>
          <div style="font-size:13px;color:#166534;margin-bottom:4px;">
            ${t.taxBody}
          </div>
          <div style="font-size:12px;color:#16a34a;opacity:0.75;">
            ${t.taxNote}
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
        <p style="margin:8px 0 0;color:rgba(255,255,255,0.2);font-size:11px;line-height:1.6;direction:${t.dir};">
          ${t.footerNote}
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

async function sendReceiptEmail(donation, synagogue, lang = 'en') {
  // Guard: no email address
  if (!donation.donorEmail) return;

  const t = T[lang] || T.en;

  // Guard: Resend not configured
  if (!isConfigured()) {
    const amount = formatCurrency(donation.amount, donation.currency);
    console.log(
      `[Email] RESEND_API_KEY not set — would send receipt to ${donation.donorEmail}` +
      ` for ${amount} (${donation.donationType}) in lang=${lang}`
    );
    return;
  }

  const resend = getResend();

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  const fromName  = 'Truma Plus';

  const amount  = formatCurrency(donation.amount, donation.currency);
  const subject = t.subject(synagogue.synagogueName, amount);

  const result = await resend.emails.send({
    from:    `${fromName} <${fromEmail}>`,
    to:      donation.donorEmail,
    subject,
    html:    buildReceiptHtml(donation, synagogue, lang),
    tags: [
      { name: 'synagogue', value: (synagogue.synagogueCode || synagogue.id).slice(0, 35) },
      { name: 'donation',  value: donation.id.slice(0, 35) },
      { name: 'type',      value: donation.donationType },
      { name: 'lang',      value: lang },
    ],
  });

  console.log(
    `[Email] Receipt sent → ${donation.donorEmail}` +
    ` | ${amount} | ${donation.donationType} | lang=${lang} | id=${result.data?.id ?? result}`
  );
  return result;
}

module.exports = { sendReceiptEmail };
