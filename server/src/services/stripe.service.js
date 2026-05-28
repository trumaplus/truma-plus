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

async function createCheckoutSession({ amount, donationType, donorInfo, synagogue }) {
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
      url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/kiosk/${synagogue.id}?success=true&donationId=${donation.id}`,
      donationId: donation.id,
      mock: true,
    };
  }

  const amountInCents = Math.round(parseFloat(amount) * 100);
  // In production CLIENT_URL must be set to the Railway public URL.
  // Never fall back to localhost for real Stripe sessions.
  const clientUrl = process.env.CLIENT_URL && !process.env.CLIENT_URL.includes('localhost')
    ? process.env.CLIENT_URL
    : 'https://truma-plus-production.up.railway.app';

  const donorName = [donorFirstName, donorLastName].filter(Boolean).join(' ');

  // Build donation type label
  const typeLabel = {
    general: 'General Donation',
    neder:   'Neder',
    aliyot:  'Aliyot',
    kiddush: 'Kiddush',
    standing:'Standing Donation',
    yizkor:  'Yizkor',
    coffee:  'Coffee Fund',
    seuda:   'Seuda',
  }[donationType] || 'Donation';

  const session = await stripe.checkout.sessions.create({
    // No payment_method_types restriction → Stripe enables card, Apple Pay,
    // Google Pay, Stripe Link automatically based on device/browser
    mode:            'payment',
    customer_email:  donorEmail || undefined,   // pre-fills Stripe's email field
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

    // Return URLs
    success_url: `${clientUrl}/kiosk/${synagogue.id}?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${clientUrl}/kiosk/${synagogue.id}?cancelled=true`,

    // Carry IDs through to webhook
    metadata: {
      donationId:   donation.id,
      synagogueId:  synagogue.id,
      donationType: donationType || 'general',
      donorName:    donorName || '',
    },

    // Custom text shown to user in Stripe Checkout
    custom_text: {
      submit: {
        message: `Your donation to ${synagogue.synagogueName} will be processed securely. A receipt will be sent to your email.`,
      },
    },
  });

  // Save Stripe session ID
  await prisma.donation.update({
    where: { id: donation.id },
    data:  { stripeSessionId: session.id },
  });

  return { url: session.url, donationId: donation.id, sessionId: session.id };
}

async function handleWebhookEvent(rawBody, signature) {
  const stripe        = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  if (webhookSecret && !webhookSecret.includes('placeholder')) {
    // Production: verify Stripe signature to prevent spoofing
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } else {
    // Dev: parse raw body without verification
    console.warn('[Webhook] No STRIPE_WEBHOOK_SECRET — skipping signature verification');
    event = JSON.parse(rawBody.toString());
  }

  // ── Payment succeeded ──────────────────────────────────────────────────────
  if (event.type === 'checkout.session.completed') {
    const session    = event.data.object;
    const donationId = session.metadata?.donationId;
    if (!donationId) return;

    // Stripe ALWAYS collects the customer's email in Checkout.
    // Use it to fill in donor info if it wasn't provided upfront.
    const stripeEmail = session.customer_details?.email || null;
    const stripeName  = session.customer_details?.name  || null;
    const nameParts   = stripeName ? stripeName.trim().split(/\s+/) : [];

    const donation = await prisma.donation.update({
      where: { id: donationId },
      data: {
        paymentStatus: 'completed',
        transactionId: session.payment_intent,
        // Backfill email/name from Stripe if not collected upfront
        ...(stripeEmail && { donorEmail: stripeEmail, receiptRequested: true }),
        ...(nameParts.length > 0 && {
          donorFirstName: nameParts[0],
          donorLastName:  nameParts.slice(1).join(' ') || null,
        }),
      },
      include: { synagogue: true },
    });

    // Send receipt email (email is now guaranteed from Stripe)
    if (donation.donorEmail) {
      await sendReceiptEmail(donation, donation.synagogue).catch(console.error);
      await prisma.donation.update({ where: { id: donationId }, data: { receiptSent: true } });
    }

    // Send thank-you SMS if phone was provided
    if (donation.donorPhone) {
      await sendThankYouSMS(donation, donation.synagogue).catch(console.error);
      await prisma.donation.update({ where: { id: donationId }, data: { smsSent: true } });
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
}

module.exports = { createCheckoutSession, handleWebhookEvent };
