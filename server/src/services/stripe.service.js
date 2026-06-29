const Stripe = require('stripe');
const { PrismaClient } = require('@prisma/client');
const { sendReceiptEmail } = require('./email.service');
const { sendThankYouSMS } = require('./sms.service');

const prisma = new PrismaClient();

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
    apiVersion: '2023-10-16',
  });
}

const isConfigured = () =>
  process.env.STRIPE_SECRET_KEY &&
  process.env.STRIPE_SECRET_KEY !== 'sk_test_placeholder';

function getClientUrl() {
  return process.env.CLIENT_URL && !process.env.CLIENT_URL.includes('localhost')
    ? process.env.CLIENT_URL
    : 'https://truma-plus-production.up.railway.app';
}

// ── Checkout Session ─────────────────────────────────────────────────────────

async function createCheckoutSession({ amount, donationType, donorInfo, synagogue, lang }) {
  const stripe = getStripe();

  const donorFirstName = donorInfo?.firstName?.trim() || null;
  const donorLastName  = donorInfo?.lastName?.trim()  || null;
  const donorEmail     = donorInfo?.email?.trim()     || null;
  const donorPhone     = donorInfo?.phone?.trim()     || null;

  // Create pending donation record
  const donation = await prisma.donation.create({
    data: {
      synagogueId:      synagogue.id,
      amount:           parseFloat(amount),
      currency:         'CAD',
      donationType:     donationType || 'general',
      donorFirstName,
      donorLastName,
      donorEmail,
      donorPhone,
      receiptRequested: !!donorEmail,
      paymentStatus:    'pending',
    },
  });

  // Dev/staging fallback when no real Stripe key
  if (!isConfigured()) {
    console.log('[Stripe] No API key — returning mock session');
    return {
      url: `${getClientUrl()}/kiosk/${synagogue.id}?success=true&donationId=${donation.id}`,
      donationId: donation.id,
      mock: true,
    };
  }

  const amountInCents = Math.round(parseFloat(amount) * 100);
  const clientUrl = getClientUrl();

  const donorName = [donorFirstName, donorLastName].filter(Boolean).join(' ');

  const typeLabel = {
    general: 'General Donation',
    neder:   'Pledges & Donations',
    aliyot:  'Torah Aliyot',
    kiddush: 'Kiddush Payment',
    standing:'Standing Order',
    coffee:  'Coffee Expenses',
    seuda:   'Seuda Shlishit',
  }[donationType] || 'Donation';

  // Build payment_intent_data for Stripe Connect direct charges
  const paymentIntentData = {};
  if (synagogue.stripeAccountId && synagogue.stripeAccountStatus === 'active') {
    paymentIntentData.transfer_data = { destination: synagogue.stripeAccountId };
    // Optional platform fee (set STRIPE_PLATFORM_FEE_PERCENT=2 for 2%)
    const feePercent = parseFloat(process.env.STRIPE_PLATFORM_FEE_PERCENT || '0');
    if (feePercent > 0) {
      paymentIntentData.application_fee_amount = Math.round(amountInCents * feePercent / 100);
    }
    console.log(`[Stripe] Using Connect account ${synagogue.stripeAccountId} for ${synagogue.synagogueName}`);
  }

  const session = await stripe.checkout.sessions.create({
    mode:            'payment',
    customer_email:  donorEmail || undefined,
    billing_address_collection: 'auto',

    line_items: [{
      price_data: {
        currency:     'cad',
        product_data: {
          name:        `${typeLabel} — ${synagogue.synagogueName}`,
          description: synagogue.city ? `${synagogue.synagogueName}, ${synagogue.city}` : synagogue.synagogueName,
          images:      synagogue.logoUrl ? [synagogue.logoUrl] : [],
        },
        unit_amount: amountInCents,
      },
      quantity: 1,
    }],

    success_url: `${clientUrl}/kiosk/${synagogue.id}?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${clientUrl}/kiosk/${synagogue.id}?cancelled=true`,

    metadata: {
      donationId:   donation.id,
      synagogueId:  synagogue.id,
      donationType: donationType || 'general',
      donorName:    donorName || '',
      lang:         lang || 'en',
    },

    custom_text: {
      submit: {
        message: `Your donation to ${synagogue.synagogueName} will be processed securely. A receipt will be sent to your email.`,
      },
    },

    ...(Object.keys(paymentIntentData).length > 0 && { payment_intent_data: paymentIntentData }),
  });

  await prisma.donation.update({
    where: { id: donation.id },
    data:  { stripeSessionId: session.id },
  });

  return { url: session.url, donationId: donation.id, sessionId: session.id };
}

// ── Webhook ───────────────────────────────────────────────────────────────────

async function handleWebhookEvent(rawBody, signature, io = null) {
  const stripe        = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  if (webhookSecret && !webhookSecret.includes('placeholder')) {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } else {
    console.warn('[Webhook] No STRIPE_WEBHOOK_SECRET — skipping signature verification');
    event = JSON.parse(rawBody.toString());
  }

  // ── Payment succeeded ──────────────────────────────────────────────────────
  if (event.type === 'checkout.session.completed') {
    const session    = event.data.object;
    const donationId = session.metadata?.donationId;
    if (!donationId) return;

    const stripeEmail = session.customer_details?.email || null;
    const stripeName  = session.customer_details?.name  || null;
    const nameParts   = stripeName ? stripeName.trim().split(/\s+/) : [];

    const emailLang = session.metadata?.lang || 'en';

    const donation = await prisma.donation.update({
      where: { id: donationId },
      data: {
        paymentStatus: 'completed',
        transactionId: session.payment_intent,
        ...(stripeEmail && { donorEmail: stripeEmail, receiptRequested: true }),
        ...(nameParts.length > 0 && {
          donorFirstName: nameParts[0],
          donorLastName:  nameParts.slice(1).join(' ') || null,
        }),
      },
      include: { synagogue: true },
    });

    if (donation.donorEmail) {
      await sendReceiptEmail(donation, donation.synagogue, emailLang).catch(console.error);
      await prisma.donation.update({ where: { id: donationId }, data: { receiptSent: true } });
    }

    if (donation.donorPhone) {
      await sendThankYouSMS(donation, donation.synagogue).catch(console.error);
      await prisma.donation.update({ where: { id: donationId }, data: { smsSent: true } });
    }

    // Notify the kiosk in real-time so it can dismiss the QR modal and show success
    if (io && donation.synagogueId) {
      io.to(donation.synagogueId).emit('donation:completed', {
        donationId: donation.id,
        amount:     donation.amount,
      });
    }
  }

  // ── Terminal payment succeeded (card_present) ─────────────────────────────
  if (event.type === 'payment_intent.succeeded') {
    const pi         = event.data.object;
    const donationId = pi.metadata?.donationId;
    // Only handle Terminal payments (source: 'terminal'); Checkout Session
    // payments are handled via checkout.session.completed above.
    if (donationId && pi.metadata?.source === 'terminal') {
      const donation = await prisma.donation.update({
        where: { id: donationId },
        data:  { paymentStatus: 'completed', transactionId: pi.id },
      }).catch(() => null);

      if (donation && io && donation.synagogueId) {
        io.to(donation.synagogueId).emit('donation:completed', {
          donationId: donation.id,
          amount:     donation.amount,
        });
      }
    }
  }

  // ── Payment failed or expired ──────────────────────────────────────────────
  if (
    event.type === 'checkout.session.expired' ||
    event.type === 'payment_intent.payment_failed'
  ) {
    const obj        = event.data.object;
    const donationId = obj.metadata?.donationId;
    if (donationId) {
      await prisma.donation.update({
        where: { id: donationId },
        data:  { paymentStatus: 'failed' },
      });
    }
  }

  // ── Stripe Connect: account updated ──────────────────────────────────────
  if (event.type === 'account.updated') {
    const account = event.data.object;
    const synagogue = await prisma.synagogue.findFirst({
      where: { stripeAccountId: account.id },
    });
    if (synagogue) {
      let status;
      if (account.charges_enabled && account.payouts_enabled) {
        status = 'active';
      } else if (account.details_submitted) {
        status = 'restricted';
      } else {
        status = 'pending';
      }
      await prisma.synagogue.update({
        where: { id: synagogue.id },
        data:  { stripeAccountStatus: status },
      });
      console.log(`[Connect] Synagogue ${synagogue.synagogueName} → status: ${status}`);
    }
  }
}

// ── Stripe Connect ────────────────────────────────────────────────────────────

/**
 * Creates a Stripe Express Connect account (if none exists) and returns an
 * onboarding AccountLink URL. Safe to call multiple times — if the account
 * already exists it just refreshes the link.
 *
 * @param {object} synagogue  - Prisma synagogue record
 * @param {string} returnPath - URL path to return to after onboarding (e.g. '/dashboard'
 *                              or '/admin/synagogue/:id'). Defaults to '/dashboard'.
 */
async function createConnectAccountLink(synagogue, returnPath = '/dashboard') {
  const stripe    = getStripe();
  const clientUrl = getClientUrl();

  let accountId = synagogue.stripeAccountId;

  if (!accountId) {
    // Create a new Express account
    const account = await stripe.accounts.create({
      type:    'express',
      country: 'CA',
      email:   synagogue.email,
      capabilities: {
        card_payments: { requested: true },
        transfers:     { requested: true },
      },
      business_profile: {
        name:                synagogue.synagogueName,
        product_description: 'Charitable donations for a religious organization',
      },
    });

    accountId = account.id;

    await prisma.synagogue.update({
      where: { id: synagogue.id },
      data:  { stripeAccountId: accountId, stripeAccountStatus: 'pending' },
    });

    console.log(`[Connect] Created Stripe Express account ${accountId} for ${synagogue.synagogueName}`);
  }

  // Create (or refresh) the onboarding link.
  // stripe_return=1  → onboarding completed
  // stripe_refresh=1 → link expired, user needs to restart
  const accountLink = await stripe.accountLinks.create({
    account:     accountId,
    refresh_url: `${clientUrl}${returnPath}?stripe_refresh=1`,
    return_url:  `${clientUrl}${returnPath}?stripe_return=1`,
    type:        'account_onboarding',
  });

  return { url: accountLink.url, accountId };
}

/**
 * Fetches the current Connect account status from Stripe and syncs it to DB.
 */
async function getConnectStatus(synagogueId) {
  const stripe    = getStripe();
  const synagogue = await prisma.synagogue.findUnique({ where: { id: synagogueId } });

  if (!synagogue?.stripeAccountId) {
    return { status: 'not_connected', accountId: null };
  }

  const account = await stripe.accounts.retrieve(synagogue.stripeAccountId);

  let status;
  if (account.charges_enabled && account.payouts_enabled) {
    status = 'active';
  } else if (account.details_submitted) {
    status = 'restricted';
  } else {
    status = 'pending';
  }

  if (status !== synagogue.stripeAccountStatus) {
    await prisma.synagogue.update({
      where: { id: synagogueId },
      data:  { stripeAccountStatus: status },
    });
  }

  return {
    status,
    accountId:        synagogue.stripeAccountId,
    chargesEnabled:   account.charges_enabled,
    payoutsEnabled:   account.payouts_enabled,
    detailsSubmitted: account.details_submitted,
  };
}

/**
 * Creates a Stripe Express Dashboard login link so the synagogue can manage
 * their payouts, view balance, etc.
 */
async function createLoginLink(synagogueId) {
  const stripe    = getStripe();
  const synagogue = await prisma.synagogue.findUnique({ where: { id: synagogueId } });

  if (!synagogue?.stripeAccountId) {
    throw new Error('No Stripe Connect account for this synagogue');
  }

  const loginLink = await stripe.accounts.createLoginLink(synagogue.stripeAccountId);
  return { url: loginLink.url };
}

module.exports = {
  createCheckoutSession,
  handleWebhookEvent,
  createConnectAccountLink,
  getConnectStatus,
  createLoginLink,
  isConfigured,
};
