-- AlterTable
ALTER TABLE "VerificationToken" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "VerificationToken_identifier_createdAt_idx" ON "VerificationToken"("identifier", "createdAt");
