-- AlterTable
ALTER TABLE "payment_links" ADD COLUMN     "expiresAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "custodial_wallets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "network" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'CUSTODIAL',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "balance" TEXT NOT NULL DEFAULT '0',
    "address" TEXT,
    "tokenDecimals" INTEGER NOT NULL DEFAULT 18,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custodial_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custodial_balance_history" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custodial_balance_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bridge_transactions" (
    "id" TEXT NOT NULL,
    "sourceToken" TEXT NOT NULL,
    "sourceChainId" INTEGER NOT NULL,
    "targetToken" TEXT NOT NULL,
    "targetChainId" INTEGER NOT NULL,
    "amount" TEXT NOT NULL,
    "userAddress" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "txHash" TEXT,
    "targetTxHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bridge_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "custodial_wallets_userId_token_chainId_key" ON "custodial_wallets"("userId", "token", "chainId");

-- AddForeignKey
ALTER TABLE "custodial_wallets" ADD CONSTRAINT "custodial_wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custodial_balance_history" ADD CONSTRAINT "custodial_balance_history_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "custodial_wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
