-- AlterTable: add Stripe Connect fields to Synagogue
ALTER TABLE "Synagogue" ADD COLUMN "stripeAccountId" TEXT;
ALTER TABLE "Synagogue" ADD COLUMN "stripeAccountStatus" TEXT;
