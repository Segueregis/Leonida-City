-- CreateEnum
CREATE TYPE "WaitlistKind" AS ENUM ('PLAYER', 'HOST');

-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "id" TEXT NOT NULL,
    "kind" "WaitlistKind" NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "city" TEXT,
    "state" TEXT,
    "countryCode" TEXT,
    "locale" TEXT NOT NULL,
    "device" TEXT,
    "consoleModel" "ConsoleModel",
    "hasGame" BOOLEAN,
    "uploadMbps" TEXT,
    "hoursPerDay" INTEGER,
    "betaTester" BOOLEAN NOT NULL DEFAULT false,
    "whatsapp" TEXT,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "utmSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WaitlistEntry_kind_createdAt_idx" ON "WaitlistEntry"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "WaitlistEntry_ipHash_createdAt_idx" ON "WaitlistEntry"("ipHash", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistEntry_kind_email_key" ON "WaitlistEntry"("kind", "email");

