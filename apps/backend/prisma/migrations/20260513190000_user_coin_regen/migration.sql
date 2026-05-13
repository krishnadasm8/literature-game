-- Passive coin regen clock (see coinEconomy + coinService.applyPassiveCoinRegen).
ALTER TABLE "User" ADD COLUMN "lastCoinRegenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
