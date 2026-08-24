-- CreateEnum
CREATE TYPE "LlmStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "SymptomForm" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "rawSymptomsText" TEXT NOT NULL,
    "aiUrgency" TEXT,
    "aiChiefComplaint" TEXT,
    "aiQuestionsJson" JSONB,
    "llmStatus" "LlmStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SymptomForm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SymptomForm_appointmentId_key" ON "SymptomForm"("appointmentId");

-- AddForeignKey
ALTER TABLE "SymptomForm" ADD CONSTRAINT "SymptomForm_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
