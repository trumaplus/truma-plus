-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Synagogue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "synagogueName" TEXT NOT NULL,
    "synagogueCode" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "city" TEXT,
    "latitude" REAL NOT NULL DEFAULT 45.5017,
    "longitude" REAL NOT NULL DEFAULT -73.5673,
    "candleLightingOffset" INTEGER NOT NULL DEFAULT 18,
    "logoUrl" TEXT,
    "theme" TEXT NOT NULL DEFAULT 'dark',
    "shabbatModeActive" BOOLEAN NOT NULL DEFAULT false,
    "slideshowInterval" INTEGER NOT NULL DEFAULT 10,
    "prayerTimes" TEXT,
    "emergencyNumbers" TEXT,
    "announcements" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Donation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "synagogueId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "donationType" TEXT NOT NULL DEFAULT 'general',
    "donorFirstName" TEXT,
    "donorLastName" TEXT,
    "donorEmail" TEXT,
    "donorPhone" TEXT,
    "donorAddress" TEXT,
    "receiptRequested" BOOLEAN NOT NULL DEFAULT false,
    "receiptSent" BOOLEAN NOT NULL DEFAULT false,
    "smsSent" BOOLEAN NOT NULL DEFAULT false,
    "paymentMethod" TEXT NOT NULL DEFAULT 'online',
    "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
    "stripeSessionId" TEXT,
    "transactionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Donation_synagogueId_fkey" FOREIGN KEY ("synagogueId") REFERENCES "Synagogue" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MediaItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "synagogueId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MediaItem_synagogueId_fkey" FOREIGN KEY ("synagogueId") REFERENCES "Synagogue" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Synagogue_synagogueCode_key" ON "Synagogue"("synagogueCode");

-- CreateIndex
CREATE UNIQUE INDEX "Synagogue_email_key" ON "Synagogue"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Donation_stripeSessionId_key" ON "Donation"("stripeSessionId");

-- CreateIndex
CREATE INDEX "Donation_synagogueId_idx" ON "Donation"("synagogueId");

-- CreateIndex
CREATE INDEX "Donation_paymentStatus_idx" ON "Donation"("paymentStatus");

-- CreateIndex
CREATE INDEX "MediaItem_synagogueId_idx" ON "MediaItem"("synagogueId");
