let twilioClient;

function getTwilio() {
  if (!twilioClient && process.env.TWILIO_ACCOUNT_SID && !process.env.TWILIO_ACCOUNT_SID.includes('placeholder')) {
    const twilio = require('twilio');
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return twilioClient;
}

async function sendThankYouSMS(donation, synagogue) {
  if (!donation.donorPhone) return;
  const client = getTwilio();
  if (!client) {
    console.log(`[SMS] Would send thank-you to ${donation.donorPhone} for $${donation.amount}`);
    return;
  }

  const donorName = donation.donorFirstName ? `, ${donation.donorFirstName}` : '';
  const message = `Thank you${donorName} for your generous donation of $${donation.amount} ${donation.currency} to ${synagogue.synagogueName}. Your support is deeply appreciated. 🙏`;

  await client.messages.create({
    body: message,
    from: process.env.TWILIO_FROM_NUMBER,
    to: donation.donorPhone,
  });
}

module.exports = { sendThankYouSMS };
