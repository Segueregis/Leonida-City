-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('BRL', 'USD', 'USDT');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('PIX', 'USDT');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('MERCADO_PAGO', 'MANUAL');

-- CreateEnum
CREATE TYPE "PayoutMethod" AS ENUM ('PIX', 'USDT');

-- CreateEnum
CREATE TYPE "PixKeyType" AS ENUM ('CPF', 'EMAIL', 'PHONE', 'RANDOM');

-- CreateEnum
CREATE TYPE "HostStatus" AS ENUM ('PENDING_ONBOARDING', 'ACTIVE', 'SUSPENDED', 'BANNED');

-- CreateEnum
CREATE TYPE "ConsoleModel" AS ENUM ('PS5', 'PS5_DIGITAL', 'PS5_PRO');

-- CreateEnum
CREATE TYPE "ConsoleStatus" AS ENUM ('OFFLINE', 'IDLE', 'PREPARING', 'IN_SESSION', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "RelayStatus" AS ENUM ('ONLINE', 'DRAINING', 'OFFLINE');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('REQUESTED', 'FUNDS_HELD', 'HOST_PREPARING', 'READY', 'ACTIVE', 'INTERRUPTED', 'EXPIRING', 'ENDED', 'ENDED_EARLY', 'HOST_FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('NOT_APPLICABLE', 'PENDING', 'HOLD', 'DISPUTED', 'SETTLED', 'REVERSED');

-- CreateEnum
CREATE TYPE "EndReason" AS ENUM ('TIME_UP', 'PLAYER_LEFT', 'HOST_CONSOLE_OFFLINE', 'HOST_NETWORK', 'PLAYER_NETWORK', 'RELAY_FAILURE', 'READY_TIMEOUT', 'ADMIN_TERMINATED', 'POLICY_VIOLATION');

-- CreateEnum
CREATE TYPE "FaultParty" AS ENUM ('NONE', 'HOST', 'PLAYER', 'PLATFORM', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "TopUpStatus" AS ENUM ('PENDING', 'PAID', 'EXPIRED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PayoutBatchStatus" AS ENUM ('DRAFT', 'APPROVED', 'PROCESSING', 'COMPLETED', 'PARTIALLY_FAILED');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'RESOLVED_REFUND', 'RESOLVED_PARTIAL', 'REJECTED');

-- CreateEnum
CREATE TYPE "LedgerAccountType" AS ENUM ('PLAYER_WALLET', 'PLAYER_HOLD', 'HOST_PENDING', 'HOST_AVAILABLE', 'PLATFORM_REVENUE', 'PLATFORM_PROMO', 'EXTERNAL_PIX_IN', 'EXTERNAL_PIX_OUT', 'EXTERNAL_PSP_FEES', 'EXTERNAL_REFUNDS');

-- CreateEnum
CREATE TYPE "LedgerTransactionKind" AS ENUM ('TOPUP', 'TOPUP_FEE', 'TOPUP_REFUND', 'SESSION_HOLD', 'SESSION_CAPTURE', 'SESSION_RELEASE', 'SETTLEMENT', 'DISPUTE_REFUND', 'PAYOUT', 'PAYOUT_REVERSAL', 'PROMO_CREDIT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "TermsDocument" AS ENUM ('PLAYER_TERMS', 'HOST_INTERMEDIATION_AGREEMENT', 'PRIVACY_POLICY');

-- CreateEnum
CREATE TYPE "StrikeReason" AS ENUM ('HOST_FAILED_TO_START', 'CONSOLE_OFFLINE_MID_SESSION', 'HOST_NETWORK_DROP', 'CHECKLIST_VIOLATION');

-- CreateTable
CREATE TABLE "Region" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" "Currency" NOT NULL,
    "timezone" TEXT NOT NULL,
    "countryCodes" TEXT[],
    "paymentMethods" "PaymentMethod"[],
    "payoutMethod" "PayoutMethod" NOT NULL,
    "payoutWeekday" INTEGER NOT NULL DEFAULT 5,
    "payoutCutoffWeekday" INTEGER NOT NULL DEFAULT 4,
    "minPayoutMinor" INTEGER NOT NULL DEFAULT 2000,
    "settlementHoldHours" INTEGER NOT NULL DEFAULT 24,
    "minTopUpMinor" INTEGER NOT NULL DEFAULT 750,
    "strikeThreshold" INTEGER NOT NULL DEFAULT 3,
    "strikeWindowDays" INTEGER NOT NULL DEFAULT 7,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Package" (
    "id" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "priceMinor" INTEGER NOT NULL,
    "hostShareBps" INTEGER NOT NULL DEFAULT 8000,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Relay" (
    "id" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "publicIp" TEXT,
    "status" "RelayStatus" NOT NULL DEFAULT 'OFFLINE',
    "maxSessions" INTEGER NOT NULL DEFAULT 20,
    "version" TEXT,
    "lastHeartbeatAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Relay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "name" TEXT,
    "image" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'pt-BR',
    "countryCode" TEXT,
    "regionId" TEXT,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "blockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "TermsAcceptance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "document" "TermsDocument" NOT NULL,
    "version" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "TermsAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HostProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "HostStatus" NOT NULL DEFAULT 'PENDING_ONBOARDING',
    "legalName" TEXT,
    "documentEncrypted" BYTEA,
    "documentHash" TEXT,
    "payoutMethod" "PayoutMethod" NOT NULL DEFAULT 'PIX',
    "pixKeyType" "PixKeyType",
    "pixKeyEncrypted" BYTEA,
    "pixKeyLast4" TEXT,
    "usdtAddress" TEXT,
    "suspendedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HostProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Console" (
    "id" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "model" "ConsoleModel" NOT NULL,
    "status" "ConsoleStatus" NOT NULL DEFAULT 'OFFLINE',
    "listed" BOOLEAN NOT NULL DEFAULT false,
    "gameTitle" TEXT NOT NULL DEFAULT 'GTA6_ONLINE',
    "secondaryOnlineId" TEXT,
    "characterSummary" TEXT,
    "checkSpendingLimitZero" BOOLEAN NOT NULL DEFAULT false,
    "checkCommsRestricted" BOOLEAN NOT NULL DEFAULT false,
    "checkConsoleSharingOn" BOOLEAN NOT NULL DEFAULT false,
    "checkRestModeNetworkOn" BOOLEAN NOT NULL DEFAULT false,
    "checkRemotePlayOn" BOOLEAN NOT NULL DEFAULT false,
    "checkPsPlusActive" BOOLEAN NOT NULL DEFAULT false,
    "checklistVerifiedAt" TIMESTAMP(3),
    "measuredUploadMbps" DOUBLE PRECISION,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Console_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsoleCredential" (
    "id" TEXT NOT NULL,
    "consoleId" TEXT NOT NULL,
    "ciphertext" BYTEA NOT NULL,
    "wrappedDataKey" BYTEA NOT NULL,
    "keyId" TEXT NOT NULL,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotatedAt" TIMESTAMP(3),

    CONSTRAINT "ConsoleCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectivityTest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "consoleId" TEXT,
    "relayHost" TEXT,
    "rttMs" INTEGER NOT NULL,
    "jitterMs" INTEGER,
    "lossPct" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConnectivityTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameSession" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "consoleId" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "relayId" TEXT,
    "status" "SessionStatus" NOT NULL DEFAULT 'REQUESTED',
    "currency" "Currency" NOT NULL,
    "priceMinor" INTEGER NOT NULL,
    "hostShareBps" INTEGER NOT NULL,
    "purchasedSeconds" INTEGER NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fundsHeldAt" TIMESTAMP(3),
    "preparingAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "pausedSeconds" INTEGER NOT NULL DEFAULT 0,
    "billableSeconds" INTEGER,
    "endReason" "EndReason",
    "faultParty" "FaultParty",
    "grantJti" TEXT,
    "grantExpiresAt" TIMESTAMP(3),
    "capturedMinor" INTEGER,
    "refundedMinor" INTEGER,
    "hostEarningMinor" INTEGER,
    "platformFeeMinor" INTEGER,
    "settlementStatus" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
    "settlementDueAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "payoutId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fromStatus" "SessionStatus",
    "toStatus" "SessionStatus",
    "actor" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionTelemetry" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "sampledAt" TIMESTAMP(3) NOT NULL,
    "ps5LinkUp" BOOLEAN NOT NULL,
    "playerLinkUp" BOOLEAN NOT NULL,
    "ps5RttMs" INTEGER,
    "playerRttMs" INTEGER,
    "bitrateKbps" INTEGER,
    "fps" INTEGER,
    "packetLossPct" DOUBLE PRECISION,

    CONSTRAINT "SessionTelemetry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "openedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "refundMinor" INTEGER,
    "resolution" TEXT,
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HostStrike" (
    "id" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "sessionId" TEXT,
    "reason" "StrikeReason" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HostStrike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HostSuspension" (
    "id" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "createdById" TEXT,
    "liftedAt" TIMESTAMP(3),

    CONSTRAINT "HostSuspension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopUp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'PIX',
    "provider" "PaymentProvider" NOT NULL DEFAULT 'MERCADO_PAGO',
    "providerPaymentId" TEXT,
    "status" "TopUpStatus" NOT NULL DEFAULT 'PENDING',
    "pixQrCodeBase64" TEXT,
    "pixCopyPaste" TEXT,
    "feeMinor" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TopUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerAccount" (
    "id" TEXT NOT NULL,
    "type" "LedgerAccountType" NOT NULL,
    "userId" TEXT,
    "currency" "Currency" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerTransaction" (
    "id" TEXT NOT NULL,
    "kind" "LedgerTransactionKind" NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "description" TEXT,
    "sessionId" TEXT,
    "topUpId" TEXT,
    "payoutId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutBatch" (
    "id" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "cutoffAt" TIMESTAMP(3) NOT NULL,
    "status" "PayoutBatchStatus" NOT NULL DEFAULT 'DRAFT',
    "totalMinor" INTEGER NOT NULL DEFAULT 0,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayoutBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL,
    "method" "PayoutMethod" NOT NULL DEFAULT 'PIX',
    "destinationMasked" TEXT NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "providerTransferId" TEXT,
    "receipt" JSONB,
    "sentAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "externalId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Region_code_key" ON "Region"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Package_regionId_code_key" ON "Package"("regionId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Relay_hostname_key" ON "Relay"("hostname");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_sessionToken_key" ON "AuthSession"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "TermsAcceptance_userId_document_idx" ON "TermsAcceptance"("userId", "document");

-- CreateIndex
CREATE UNIQUE INDEX "HostProfile_userId_key" ON "HostProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "HostProfile_documentHash_key" ON "HostProfile"("documentHash");

-- CreateIndex
CREATE INDEX "Console_regionId_status_listed_idx" ON "Console"("regionId", "status", "listed");

-- CreateIndex
CREATE UNIQUE INDEX "ConsoleCredential_consoleId_key" ON "ConsoleCredential"("consoleId");

-- CreateIndex
CREATE INDEX "ConnectivityTest_userId_createdAt_idx" ON "ConnectivityTest"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GameSession_grantJti_key" ON "GameSession"("grantJti");

-- CreateIndex
CREATE INDEX "GameSession_status_idx" ON "GameSession"("status");

-- CreateIndex
CREATE INDEX "GameSession_consoleId_status_idx" ON "GameSession"("consoleId", "status");

-- CreateIndex
CREATE INDEX "GameSession_playerId_createdAt_idx" ON "GameSession"("playerId", "createdAt");

-- CreateIndex
CREATE INDEX "GameSession_hostId_settlementStatus_idx" ON "GameSession"("hostId", "settlementStatus");

-- CreateIndex
CREATE INDEX "GameSession_settlementStatus_settlementDueAt_idx" ON "GameSession"("settlementStatus", "settlementDueAt");

-- CreateIndex
CREATE INDEX "SessionEvent_sessionId_createdAt_idx" ON "SessionEvent"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "SessionTelemetry_sessionId_sampledAt_idx" ON "SessionTelemetry"("sessionId", "sampledAt");

-- CreateIndex
CREATE INDEX "Dispute_status_idx" ON "Dispute"("status");

-- CreateIndex
CREATE INDEX "HostStrike_hostId_createdAt_idx" ON "HostStrike"("hostId", "createdAt");

-- CreateIndex
CREATE INDEX "HostSuspension_hostId_startsAt_idx" ON "HostSuspension"("hostId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "TopUp_providerPaymentId_key" ON "TopUp"("providerPaymentId");

-- CreateIndex
CREATE INDEX "TopUp_userId_createdAt_idx" ON "TopUp"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "TopUp_status_idx" ON "TopUp"("status");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerAccount_type_userId_currency_key" ON "LedgerAccount"("type", "userId", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerTransaction_idempotencyKey_key" ON "LedgerTransaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "LedgerTransaction_sessionId_idx" ON "LedgerTransaction"("sessionId");

-- CreateIndex
CREATE INDEX "LedgerEntry_accountId_createdAt_idx" ON "LedgerEntry"("accountId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PayoutBatch_regionId_cutoffAt_key" ON "PayoutBatch"("regionId", "cutoffAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_providerTransferId_key" ON "Payout"("providerTransferId");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_batchId_hostId_key" ON "Payout"("batchId", "hostId");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_provider_externalId_key" ON "WebhookEvent"("provider", "externalId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_targetType_targetId_idx" ON "AdminAuditLog"("targetType", "targetId");

-- AddForeignKey
ALTER TABLE "Package" ADD CONSTRAINT "Package_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Relay" ADD CONSTRAINT "Relay_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermsAcceptance" ADD CONSTRAINT "TermsAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostProfile" ADD CONSTRAINT "HostProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Console" ADD CONSTRAINT "Console_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "HostProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Console" ADD CONSTRAINT "Console_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsoleCredential" ADD CONSTRAINT "ConsoleCredential_consoleId_fkey" FOREIGN KEY ("consoleId") REFERENCES "Console"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectivityTest" ADD CONSTRAINT "ConnectivityTest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectivityTest" ADD CONSTRAINT "ConnectivityTest_consoleId_fkey" FOREIGN KEY ("consoleId") REFERENCES "Console"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "HostProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_consoleId_fkey" FOREIGN KEY ("consoleId") REFERENCES "Console"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_relayId_fkey" FOREIGN KEY ("relayId") REFERENCES "Relay"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "Payout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionEvent" ADD CONSTRAINT "SessionEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionTelemetry" ADD CONSTRAINT "SessionTelemetry_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostStrike" ADD CONSTRAINT "HostStrike_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "HostProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostStrike" ADD CONSTRAINT "HostStrike_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostSuspension" ADD CONSTRAINT "HostSuspension_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "HostProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostSuspension" ADD CONSTRAINT "HostSuspension_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopUp" ADD CONSTRAINT "TopUp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_topUpId_fkey" FOREIGN KEY ("topUpId") REFERENCES "TopUp"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "Payout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "LedgerTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutBatch" ADD CONSTRAINT "PayoutBatch_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutBatch" ADD CONSTRAINT "PayoutBatch_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PayoutBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "HostProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Contas de sistema do ledger (userId nulo) devem ser únicas por (tipo, moeda).
-- O UNIQUE gerado pelo Prisma não cobre NULL no Postgres.
CREATE UNIQUE INDEX "ledger_account_system_uq" ON "LedgerAccount"("type", "currency") WHERE "userId" IS NULL;
