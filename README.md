# PayLinc - Simplified Payment Links Platform

A streamlined payment processing platform built with NestJS that allows users to create payment links and accept payments via multiple methods including Stripe, Paystack, and cryptocurrency.

## Features

### Core User Flow

1. **User Authentication** - Simple sign up/sign in system
2. **Payment Links** - Create payment links with name, amount, and currency
3. **Multi-Payment Support** - Accept payments via:
   - **Stripe** for USD, GBP, EUR
   - **Paystack** for NGN
   - **Crypto addresses** for USDC, USDT, ESPEES (via Circles infrastructure)
   - **Circle Developer Controlled Wallets** for secure crypto wallet management
4. **Balance Management** - View balances and convert between currencies
5. **Withdrawals** - Request withdrawals via email to info@paylinc.org

### Supported Currencies

- **Fiat**: USD, GBP, EUR, NGN
- **Crypto**: USDC, USDT, ESPEES

## Quick Start

### Installation

```bash
yarn install
```

### Environment Setup

Create a `.env` file with:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/paylinc"

# JWT
JWT_SECRET="your-jwt-secret"

# Stripe (for USD, GBP, EUR)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_PUBLISHABLE_KEY="pk_test_..."

# Paystack (for NGN)
PAYSTACK_SECRET_KEY="sk_test_..."
PAYSTACK_PUBLIC_KEY="pk_test_..."

# Circle Developer Controlled Wallets (for crypto wallet management)
CIRCLE_API_KEY="your-circle-api-key"
CIRCLE_ENTITY_SECRET="your-circle-entity-secret"
CIRCLE_WALLET_SET_ID="your-circle-wallet-set-id"

# Email (for withdrawal notifications)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"

# Cloudinary (for file uploads)
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"
```

### Circle Developer Controlled Wallets Setup

**Automatic Multi-Chain Integration**: Circle wallets are created automatically during user registration across all major EVM blockchains following [Circle's onboarding best practices](https://developers.circle.com/w3s/onboard-users-to-developer-controlled-wallets).

**Setup Steps**:

1. **Sign up for Circle Developer Account**: Visit [Circle Developer Portal](https://developers.circle.com/)
2. **Create a new project** and obtain your API key
3. **Generate Entity Secret**: Use the Circle console or generate programmatically
4. **Create Wallet Set**: Create a wallet set in the Circle console
5. **Configure Environment Variables**: Add the Circle credentials to your `.env` file

**Multi-Blockchain Support**:

- **Production**: ETH, MATIC-POS, ARB, AVAX, BASE, OP (Mainnets)
- **Development**: ETH-SEPOLIA, MATIC-AMOY, ARB-SEPOLIA, AVAX-FUJI, BASE-SEPOLIA, OP-SEPOLIA (Testnets)

**Smart Contract Accounts (SCA)**: Each user automatically receives Smart Contract Account wallets for enhanced security and functionality across all supported EVM blockchains.

### Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev
```

**Note**: If you encounter database permission issues, you may need to run the Circle wallet migration manually:

```sql
-- Add this to your database manually if migration fails
CREATE TABLE "circle_wallets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "blockchain" TEXT NOT NULL,
    "accountType" TEXT NOT NULL DEFAULT 'SCA',
    "state" TEXT NOT NULL DEFAULT 'LIVE',
    "walletSetId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "circle_wallets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "circle_wallets_walletId_key" ON "circle_wallets"("walletId");
CREATE UNIQUE INDEX "circle_wallets_address_key" ON "circle_wallets"("address");
CREATE UNIQUE INDEX "circle_wallets_userId_blockchain_key" ON "circle_wallets"("userId", "blockchain");

ALTER TABLE "circle_wallets" ADD CONSTRAINT "circle_wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

### Running the Application

```bash
# Development
yarn start:dev

# Production
yarn start:prod
```

## API Endpoints

### Authentication

- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `GET /auth/profile` - Get user profile
- `POST /auth/verify-otp` - Verify email OTP

### Payment Links

- `GET /payment-links` - Get user's payment links
- `POST /payment-links` - Create new payment link
- `GET /payment-links/:id` - Get payment link details (public)
- `POST /payment-links/:id/pay` - Process payment
- `PATCH /payment-links/:id` - Update payment link
- `DELETE /payment-links/:id` - Delete payment link

### Balance & Payments

- `GET /balance` - Get user balances
- `POST /balance/send` - Send money
- `POST /balance/withdraw` - Request withdrawal
- `POST /balance/convert` - Convert currencies
- `GET /balance/rates` - Get exchange rates
- `GET /balance/activity` - Get transaction history

### Circle Wallets

- `GET /circle-wallets` - Get user's Circle wallets
- `GET /circle-wallets/:walletId/details` - Get wallet details from Circle API
- `POST /circle-wallets/create` - Create new Circle wallets
- `GET /circle-wallets/status` - Check Circle service configuration

## Payment Flow

### Creating a Payment Link

```json
POST /payment-links
{
  "name": "Website Design Service",
  "amount": 500.00,
  "currency": "USD"
}
```

### Payment Processing

When a customer pays via the link:

1. **Card payments** (USD/GBP/EUR) → Stripe
2. **NGN payments** → Paystack
3. **Crypto payments** → Circles infrastructure addresses

### Withdrawal Process

```json
POST /balance/withdraw
{
  "currency": "USD",
  "amount": 250.00,
  "accountNameOrAddress": "John Doe",
  "accountNumber": "1234567890", // For fiat
  "bankName": "Bank of America",  // For fiat
  "bankCode": "12345"            // For fiat
}
```

Withdrawal requests automatically:

- Send detailed email to `info@paylinc.org`
- Send confirmation email to user
- Create withdrawal record in database

## Project Structure

```
src/
├── auth/              # Authentication (login, register, JWT)
├── balance/           # Balance management & currency conversion
├── payment-link/      # Payment link creation & processing
├── profile/           # User profile management
├── circle/            # Circle Developer Controlled Wallets
├── services/
│   ├── payment-processor/  # Multi-provider payment processing
│   ├── withdrawal/         # Withdrawal email service
│   ├── stripe/            # Stripe integration
│   ├── circle/            # Circle wallet service
│   └── nodemailer/        # Email service
├── prisma/            # Database layer
└── config/            # Application configuration
```

## Currency Support Details

- **USD, GBP, EUR**: Processed via Stripe with card payments
- **NGN**: Processed via Paystack for local Nigerian payments
- **USDC, USDT**: Ethereum-based stablecoins via crypto addresses
- **ESPEES**: Circles network native currency

## Development

### Testing

```bash
yarn test
yarn test:e2e
```

### Database Management

```bash
# Reset database
npx prisma migrate reset

# View data
npx prisma studio
```

## License

This project is licensed under the MIT License.
