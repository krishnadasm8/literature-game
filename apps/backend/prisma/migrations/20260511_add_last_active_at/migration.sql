-- Add missing column required by Prisma schema
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

