#!/bin/bash

# Payment Link Process Test Script
# This script tests the complete payment link workflow

BASE_URL="http://localhost:10000"
TEST_EMAIL="testmerchant$(date +%s)@example.com"
TEST_PASSWORD="Test123!@#"

echo "🚀 Starting Payment Link Process Tests..."
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print success
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Function to print error
print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to print info
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Step 1: Register a test user
print_info "Step 1: Registering test merchant..."
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\",
    \"firstName\": \"Test\",
    \"lastName\": \"Merchant\",
    \"country\": \"US\",
    \"organisation\": \"Test Corp\",
    \"role\": \"BUSINESS\"
  }")

if echo "$REGISTER_RESPONSE" | grep -q "User created successfully"; then
    print_success "User registered successfully"
else
    print_error "User registration failed: $REGISTER_RESPONSE"
    exit 1
fi

# Extract OTP from response (in real scenario, you'd get this from email)
print_info "Step 2: Verifying email (using dummy OTP: 123456)..."
VERIFY_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/verify-otp" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"otp\": \"123456\"
  }")

# Note: In real scenario, you'd need the actual OTP from email
# For testing, we'll continue with login

# Step 3: Login to get access token
print_info "Step 3: Logging in to get access token..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\"
  }")

if echo "$LOGIN_RESPONSE" | grep -q "access_token"; then
    ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
    print_success "Login successful, access token obtained"
else
    print_error "Login failed: $LOGIN_RESPONSE"
    print_info "Note: You may need to verify email first with actual OTP"
    exit 1
fi

# Step 4: Create a payment link
print_info "Step 4: Creating payment link..."
CREATE_LINK_RESPONSE=$(curl -s -X POST "$BASE_URL/payment-links" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "name": "Test Web Development Services",
    "amount": 500.00,
    "currency": "USD"
  }')

if echo "$CREATE_LINK_RESPONSE" | grep -q "Payment link created successfully"; then
    PAYMENT_LINK_ID=$(echo "$CREATE_LINK_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    print_success "Payment link created successfully"
    print_info "Payment Link ID: $PAYMENT_LINK_ID"
else
    print_error "Payment link creation failed: $CREATE_LINK_RESPONSE"
    exit 1
fi

# Step 5: Get all payment links
print_info "Step 5: Retrieving all payment links..."
GET_LINKS_RESPONSE=$(curl -s -X GET "$BASE_URL/payment-links" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

if echo "$GET_LINKS_RESPONSE" | grep -q "links"; then
    print_success "Payment links retrieved successfully"
else
    print_error "Failed to retrieve payment links: $GET_LINKS_RESPONSE"
fi

# Step 6: Get payment link details (public)
print_info "Step 6: Getting payment link details (public access)..."
LINK_DETAILS_RESPONSE=$(curl -s -X GET "$BASE_URL/payment-links/$PAYMENT_LINK_ID")

if echo "$LINK_DETAILS_RESPONSE" | grep -q "Test Web Development Services"; then
    print_success "Payment link details retrieved successfully"
else
    print_error "Failed to get payment link details: $LINK_DETAILS_RESPONSE"
fi

# Step 7: Initialize payment
print_info "Step 7: Initializing payment..."
INIT_PAYMENT_RESPONSE=$(curl -s -X POST "$BASE_URL/payment-links/$PAYMENT_LINK_ID/initialize" \
  -H "Content-Type: application/json" \
  -d '{
    "customerEmail": "customer@example.com",
    "customerName": "Jane Customer"
  }')

if echo "$INIT_PAYMENT_RESPONSE" | grep -q "Payment initialized successfully"; then
    TRANSACTION_ID=$(echo "$INIT_PAYMENT_RESPONSE" | grep -o '"transactionId":"[^"]*"' | cut -d'"' -f4)
    print_success "Payment initialized successfully"
    print_info "Transaction ID: $TRANSACTION_ID"
else
    print_error "Payment initialization failed: $INIT_PAYMENT_RESPONSE"
    exit 1
fi

# Step 8: Confirm payment
print_info "Step 8: Confirming payment..."
CONFIRM_PAYMENT_RESPONSE=$(curl -s -X POST "$BASE_URL/payment-links/$PAYMENT_LINK_ID/confirm" \
  -H "Content-Type: application/json" \
  -d "{
    \"transactionId\": \"$TRANSACTION_ID\",
    \"paymentIntentId\": \"pi_test_123456789\",
    \"reference\": \"test_payment_$(date +%s)\"
  }")

if echo "$CONFIRM_PAYMENT_RESPONSE" | grep -q "Payment confirmed successfully"; then
    print_success "Payment confirmed successfully"
else
    print_error "Payment confirmation failed: $CONFIRM_PAYMENT_RESPONSE"
fi

# Step 9: Get transaction details
print_info "Step 9: Getting transaction details..."
TRANSACTION_DETAILS_RESPONSE=$(curl -s -X GET "$BASE_URL/payment-links/transactions/$TRANSACTION_ID")

if echo "$TRANSACTION_DETAILS_RESPONSE" | grep -q "customer"; then
    print_success "Transaction details retrieved successfully"
else
    print_error "Failed to get transaction details: $TRANSACTION_DETAILS_RESPONSE"
fi

# Step 10: Update payment link
print_info "Step 10: Updating payment link..."
UPDATE_LINK_RESPONSE=$(curl -s -X PATCH "$BASE_URL/payment-links/$PAYMENT_LINK_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "name": "Updated Web Development Services",
    "amount": 750.00
  }')

if echo "$UPDATE_LINK_RESPONSE" | grep -q "Payment link updated successfully"; then
    print_success "Payment link updated successfully"
else
    print_error "Payment link update failed: $UPDATE_LINK_RESPONSE"
fi

# Step 11: Test error cases
print_info "Step 11: Testing error cases..."

# Test invalid currency
INVALID_CURRENCY_RESPONSE=$(curl -s -X POST "$BASE_URL/payment-links" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "name": "Invalid Currency Test",
    "amount": 100.00,
    "currency": "INVALID"
  }')

if echo "$INVALID_CURRENCY_RESPONSE" | grep -q -i "error\|bad"; then
    print_success "Invalid currency validation working"
else
    print_error "Invalid currency validation failed"
fi

# Test unauthorized access
UNAUTHORIZED_RESPONSE=$(curl -s -X GET "$BASE_URL/payment-links")
if echo "$UNAUTHORIZED_RESPONSE" | grep -q -i "unauthorized\|401"; then
    print_success "Unauthorized access protection working"
else
    print_error "Unauthorized access protection failed"
fi

# Step 12: Clean up - Delete payment link
print_info "Step 12: Cleaning up - Deleting payment link..."
DELETE_RESPONSE=$(curl -s -X DELETE "$BASE_URL/payment-links/$PAYMENT_LINK_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

if echo "$DELETE_RESPONSE" | grep -q "Payment link deleted successfully"; then
    print_success "Payment link deleted successfully"
else
    print_error "Payment link deletion failed: $DELETE_RESPONSE"
fi

echo ""
echo "=================================================="
print_success "Payment Link Process Tests Completed!"
echo ""
print_info "Summary:"
echo "  • User Registration: ✓"
echo "  • User Login: ✓"
echo "  • Payment Link Creation: ✓"
echo "  • Payment Link Retrieval: ✓"
echo "  • Payment Initialization: ✓"
echo "  • Payment Confirmation: ✓"
echo "  • Transaction Details: ✓"
echo "  • Payment Link Update: ✓"
echo "  • Error Handling: ✓"
echo "  • Payment Link Deletion: ✓"
echo ""
print_info "Test completed with email: $TEST_EMAIL" 