require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin@donationplus.com';
  const password = process.env.ADMIN_PASSWORD || 'Admin123!';

  const existing = await prisma.admin.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin already exists: ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const admin = await prisma.admin.create({ data: { email, passwordHash } });
  console.log(`Admin created: ${admin.email}`);

  // Demo synagogue
  const demoHash = await bcrypt.hash('Demo123!', 10);
  const demo = await prisma.synagogue.upsert({
    where: { email: 'demo@bethshalom.com' },
    update: {},
    create: {
      synagogueName: 'Beth Shalom',
      synagogueCode: 'beth-shalom',
      email: 'demo@bethshalom.com',
      passwordHash: demoHash,
      city: 'Montreal',
      latitude: 45.5017,
      longitude: -73.5673,
      theme: 'dark',
      announcements: JSON.stringify([
        { id: '1', text: 'Mincha at 6:30 PM daily', active: true },
        { id: '2', text: 'Shabbat Kiddush sponsored by the Cohen family', active: true },
      ]),
      prayerTimes: JSON.stringify({
        weekday: { shacharit: '7:00 AM', mincha: '6:30 PM', maariv: '8:00 PM' },
        shabbat: { shacharit: '9:00 AM', mincha: '5:30 PM', maariv: '8:30 PM' },
      }),
    },
  });
  console.log(`Demo synagogue: ${demo.synagogueName}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
