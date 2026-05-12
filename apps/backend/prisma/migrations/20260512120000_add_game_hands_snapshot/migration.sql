-- Align Game with Prisma schema (handsSnapshot used by game engine / gameManager)
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "handsSnapshot" JSONB;
