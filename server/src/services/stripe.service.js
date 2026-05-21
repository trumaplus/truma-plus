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

async function createCheckoutSession({ amount, donationType, donorInfo, synagogue }) {
  const stripe = getStripe();
  const isPlaceholder = !process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_placeholder';

  const donorFirstName = donorInfo?.firstName || null;
  const donorLastName = donorInfo?.lastName || null;
  const donorEmail = donorInfo?.email || null;
  const donorPhone = donorInfo?.phone || null;

  // Create donation record first
  const donation = await prisma.donation.create({
    data: {
      synagogueId: synagogue.id,
      amount: parseFloat(amount),
      currency: 'CAD',
      donationType: donationType || 'general',
      donorFirstName,
      donorLastName,
      donorEmail,
      donorPhone,
      receiptRequested: !!donorEmail,
      paymentStatus: 'pending',
    },
  });

  if (isPlaceholder) {
    // Dev mode: return a mock session
    return {
      url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/kiosk/${synagogue.id}?success=true&donationId=${donation.id}`,
      donationId: donation.id,
      mock: true,
    };
  }

  const amountInCents = Math.round(parseFloat(amount) * 100);
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'cad',
        product_data: {
          name: `Donation — ${donationType || 'General'}`,
          description: `${synagogue.synagogueName}`,
        },
        unit_amount: amountInCents,
      },
      quantity: 1,
    }],
    mode: 'payment',
    customer_email: donorEmail || undefined,
    success_url: `${clientUrl}/kiosk/${synagogue.id}?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${clientUrl}/kiosk/${synagogue.id}?cancelled=true`,
    metadata: {
      donationId: donation.id,
      synagogueId: synagogue.id,
      donationType: donationType || 'general',
    },
  });

  // Save session ID
  await prisma.donation.update({
    where: { id: donation.id },
    data: { stripeSessionId: session.id },
  });

  return { url: session.url, donationId: donation.id, sessionId: session.id };
}

async function handleWebhookEvent(rawBody, signature) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  if (webhookSecret && !webhookSecret.includes('placeholder')) {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } else {
    event = JSON.parse(rawBody.toString());
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const donationId = session.metadata?.donationId;
    if (!donationId) return;

    const donation = await prisma.donation.update({
      where: { id: donationId },
      data: {
        paymentStatus: 'completed',
        transactionId: session.payment_intent,
      },
      include: { synagogue: true },
    });

    if (donation.donorEmail) {
      await sendReceiptEmail(donation, donation.synagogue).catch(console.error);
      await prisma.donation.update({ where: { id: donationId }, data: { receiptSent: true } });
    }

    if (donation.donorPhone) {
      await sendThankYouSMS(donation, donation.synagogue).catch(console.error);
      await prisma.donation.update({ where: { id: donationId }, data: { smsSent: true } });
    }
  }

  if (event.type === 'checkout.session.expired' || event.type === 'payment_intent.payment_failed') {
    const session = event.data.object;
    const donationId = session.metadata?.donationId;
    if (donationId) {
      await prisma.donation.update({ where: { id: donationId }, data: { paymentStatus: 'failed' } });
    }
  }
}

module.exports = { createCheckoutSession, handleWebhookEvent };
