import { USER_ROLE_LIST } from './roles.contract';

export const systemResponses = {
  EN: {
    // Authentication Responses
    USER_EMAIL_EXISTS: 'Email already registered',
    INVALID_TOKEN: 'Invalid or expired token',
    INVALID_OTP: 'Invalid or expired OTP',
    AUTHENTICATION_FAILED: 'Authentication failed',
    USER_NOT_FOUND: 'User not found',
    MAX_OTP_ATTEMPTS: 'Maximum OTP validation attempts exceeded',
    OTP_SENT: 'If the email exists, an OTP will be sent',
    EMAIL_SEND_ERROR: 'Failed to send email',
    WEAK_PASSWORD: 'Password does not meet security requirements',
    INVALID_ROLE: (providedRole: string) =>
      `Invalid role: ${providedRole}. Role must be one of: ${USER_ROLE_LIST.join(', ')}`,

    // Success Messages
    OTP_VALIDATED: 'OTP validated successfully',
    PASSWORD_RESET_SUCCESS: 'Password reset successful',
    LOGIN_SUCCESS: 'Login successful',
    USER_CREATED: 'User created successfully',
    EMAIL_VERIFIED: 'Email verified successfully',

    // Error Messages
    INTERNAL_SERVER_ERROR: 'An internal server error occurred',
    USER_CREATION_ERROR: 'Error creating user',
    AUTH_ERROR: 'Error during authentication',
    UNABLE_TO_CREATE_USER: 'Unable to create user',
    USER_UPDATE_ERROR: 'Error updating user',
    USER_DELETE_ERROR: 'Error deleting user',

    // Wallet Related
    WALLET_CREATION_ERROR: 'Error creating wallet',
    WALLET_EXISTS: 'Wallet already exists for this user',
    INVALID_WALLET_ADDRESS: 'Invalid wallet address',
    WALLET_ENCRYPTION_ERROR: 'Error encrypting wallet data',

    // Password Related
    CURRENT_PASSWORD_INCORRECT: 'Current password is incorrect',
    PASSWORDS_DO_NOT_MATCH: 'New password and confirmation do not match',
    NEW_PASSWORD_SAME_AS_CURRENT: 'New password must be different from current password',
    PASSWORD_CHANGE_SUCCESS: 'Password changed successfully',
    PASSWORD_CHANGE_ERROR: 'Error changing password',
    PASSWORD_RESET_REQUEST_SUCCESS: 'Password reset instructions sent to email',
    PASSWORD_RESET_REQUEST_ERROR: 'Error requesting password reset',

    // Email Related
    EMAIL_VERIFICATION_REQUIRED: 'Please verify your email address',
    EMAIL_ALREADY_VERIFIED: 'Email already verified',
    EMAIL_VERIFICATION_SUCCESS: 'Email verified successfully',
    EMAIL_VERIFICATION_ERROR: 'Error verifying email',
    EMAIL_VERIFICATION_EXPIRED: 'Email verification link expired',
    EMAIL_CHANGE_SUCCESS: 'Email changed successfully',
    EMAIL_CHANGE_ERROR: 'Error changing email',

    // Profile Related
    PROFILE_UPDATE_SUCCESS: 'Profile updated successfully',
    PROFILE_UPDATE_ERROR: 'Error updating profile',
    PROFILE_RETRIEVAL_ERROR: 'Error retrieving profile',
    PROFILE_NOT_FOUND: 'Profile not found',

    // Balance Related
    INSUFFICIENT_BALANCE: 'Insufficient balance for this transaction',
    INVALID_CURRENCY: 'Invalid currency specified',
    TRANSFER_SUCCESSFUL: 'Transfer completed successfully',
    TRANSFER_FAILED: 'Transfer failed',
    INVALID_AMOUNT: 'Invalid amount specified',
    BALANCE_FETCH_ERROR: 'Error fetching balance',
    
    // Payment Related
    PAYMENT_REQUEST_CREATED: 'Payment request created successfully',
    PAYMENT_REQUEST_FAILED: 'Failed to create payment request',
    PAYMENT_NOT_FOUND: 'Payment request not found',
    PAYMENT_ALREADY_PROCESSED: 'Payment has already been processed',
    PAYMENT_PROCESSED: 'Payment processed successfully',
    
    // Conversion Related
    CONVERSION_FAILED: 'Currency conversion failed',
    INVALID_CONVERSION_PAIR: 'Invalid currency conversion pair',
    
    // Recipient Related
    RECIPIENT_NOT_FOUND: 'Recipient not found',
    INVALID_RECIPIENT: 'Invalid recipient details',
    SELF_TRANSFER_NOT_ALLOWED: 'Cannot transfer to self',
    
    // Crypto Related
    INVALID_WALLET_CREDENTIALS: 'Invalid wallet credentials',
    CRYPTO_TRANSFER_FAILED: 'Cryptocurrency transfer failed',
    BLOCKCHAIN_ERROR: 'Blockchain transaction failed',
  },
}; 