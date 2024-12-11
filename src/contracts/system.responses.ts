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
    PROFILE_UPDATED: 'Profile updated successfully',
    SECURITY_SETTINGS_UPDATED: 'Security settings updated successfully',
    PHOTO_NOT_FOUND: 'Profile photo not found',

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

    // Transaction Related
    TRANSACTIONS_NOT_FOUND: 'No transactions found',
    TRANSACTION_FETCH_ERROR: 'Error fetching transactions',
    TRANSACTION_INITIATED: 'Transaction initiated successfully',
    TRANSACTION_COMPLETED: 'Transaction completed successfully',
    TRANSACTION_STATUS_UPDATED: 'Transaction status updated',
    TRANSACTION_VALIDATION_FAILED: 'Transaction validation failed',
    TRANSACTION_EXPIRED: 'Transaction has expired',
    TRANSACTION_INVALID_STATUS: 'Invalid transaction status',
    TRANSACTION_HISTORY_RETRIEVED: 'Transaction history retrieved successfully',
    TRANSACTION_FAILED: 'Transaction failed',
    INVALID_TRANSACTION_TYPE: 'Invalid transaction type',
    INVALID_TRANSACTION_STATUS: 'Invalid transaction status',
    
    // Wallet Related
    WALLET_NOT_FOUND: 'Wallet not found',
    WALLET_UPDATE_ERROR: 'Error updating wallet',
    WALLET_INITIALIZATION_ERROR: 'Error initializing wallet',
    
    // Settings Related
    SETTINGS_UPDATE_FAILED: 'Failed to update settings',
    SETTINGS_INVALID: 'Invalid settings provided',

    // Payment Link Related
    PAYMENT_LINK_CREATED: 'Payment link created successfully',
    PAYMENT_LINK_NOT_FOUND: 'Payment link not found',
    PAYMENT_LINK_EXPIRED: 'Payment link has expired',
    PAYMENT_LINK_INACTIVE: 'Payment link is no longer active',
    PAYMENT_LINK_UPDATE_FAILED: 'Failed to update payment link',
    PAYMENT_LINK_SETTINGS_UPDATED: 'Payment link settings updated successfully',
    PAYMENT_LINK_INVALID_TYPE: 'Invalid payment link type',
    PAYMENT_LINK_UNAUTHORIZED: 'Unauthorized to access this payment link',

    // Escrow Related
    ESCROW_CREATED: 'Escrow contract created successfully',
    ESCROW_FUNDED: 'Escrow funded successfully',
    ESCROW_RELEASED: 'Escrow released successfully',
    ESCROW_CREATION_FAILED: 'Failed to create escrow contract',
    ESCROW_FUNDING_FAILED: 'Failed to fund escrow',
    ESCROW_RELEASE_FAILED: 'Failed to release escrow',
    ESCROW_NOT_FOUND: 'Escrow contract not found',
    ESCROW_INVALID_STATE: 'Invalid escrow state for this operation',

    // Payment Method Related
    PAYMENT_METHOD_ADDED: 'Payment method added successfully',
    PAYMENT_METHOD_DELETED: 'Payment method deleted successfully',
    PAYMENT_METHOD_NOT_FOUND: 'Payment method not found',
    PAYMENT_METHOD_UPDATE_FAILED: 'Failed to update payment method',
    PAYMENT_METHOD_FETCH_ERROR: 'Error fetching payment methods',
    PAYMENT_METHOD_EXISTS: 'Payment method already exists',
    INVALID_BANK_SELECTED: 'Invalid bank selected. Please choose from the supported banks list',
    DEFAULT_PAYMENT_METHOD_UPDATED: 'Default payment method updated successfully',
    AUTO_PAYMENT_SETTINGS_UPDATED: 'Auto-payment settings updated successfully',

    // API Key Related
    API_KEY_GENERATED: 'API key generated successfully',
    API_KEY_REGENERATED: 'API key regenerated successfully',
    API_KEY_REVOKED: 'API key revoked successfully',
    API_KEY_INVALID: 'Invalid API key',
    API_KEY_DISABLED: 'API key is disabled',
    API_KEY_MISSING: 'API key is required',
    API_KEY_FETCH_ERROR: 'Error fetching API key',
    API_KEY_UPDATE_ERROR: 'Error updating API key',
    API_KEY_ALREADY_EXISTS: 'API key already exists for this user',
    API_KEY_NOT_FOUND: 'API key not found',
    API_ACCESS_DISABLED: 'API access is disabled for this account',
    API_SETTINGS_UPDATED: 'API settings updated successfully',
    API_SETTINGS_UPDATE_FAILED: 'Failed to update API settings',

    // Authentication Related (Additional)
    INVALID_CREDENTIALS_OR_API_KEY: 'Invalid credentials or API key',
    AUTHENTICATION_METHOD_REQUIRED: 'Either JWT token or API key is required for authentication',
    API_KEY_AUTHENTICATION_FAILED: 'API key authentication failed',
    JWT_AUTHENTICATION_FAILED: 'JWT authentication failed',
    JWT_AUTHENTICATION_REQUIRED: 'JWT authentication is required for web app requests',
    API_INTEGRATION_AUTH_REQUIRED: 'API key authentication is required for API integration requests',

    // Profile Related (Additional)
    API_SETTINGS_FETCH_ERROR: 'Error fetching API settings',
    API_KEY_VISIBILITY_UPDATED: 'API key visibility updated',
    API_KEY_PERMISSIONS_UPDATED: 'API key permissions updated',
    API_KEY_RATE_LIMIT_EXCEEDED: 'API rate limit exceeded',

    // Profile Photo Related
    PHOTO_UPDATED: 'Profile photo updated successfully',
    PHOTO_UPDATE_FAILED: 'Failed to update profile photo',
    PHOTO_DELETED: 'Profile photo deleted successfully',
    PHOTO_DELETE_FAILED: 'Failed to delete profile photo',
    INVALID_PHOTO_FORMAT: 'Invalid photo format. Please upload a valid image file',
    PHOTO_SIZE_TOO_LARGE: 'Photo size exceeds maximum limit',
    PHOTO_UPLOAD_ERROR: 'Error uploading photo',

    // File Upload Related
    FILE_UPLOAD_SUCCESS: 'File uploaded successfully',
    FILE_UPLOAD_FAILED: 'Failed to upload file',
    FILE_DELETE_SUCCESS: 'File deleted successfully',
    FILE_DELETE_FAILED: 'Failed to delete file',
    FILE_NOT_FOUND: 'File not found',
    FILE_TOO_LARGE: 'File size exceeds the maximum limit of 5MB',
    INVALID_FILE_TYPE: 'Invalid file type. Only JPEG, PNG, and GIF files are allowed',
    FILE_PROCESSING_ERROR: 'Error processing file',
    FILE_STORAGE_ERROR: 'Error storing file',
    FILE_RETRIEVAL_ERROR: 'Error retrieving file',

    // Cloudinary Specific
    CLOUDINARY_CONFIG_ERROR: 'Error configuring Cloudinary',
    CLOUDINARY_UPLOAD_ERROR: 'Error uploading to Cloudinary',
    CLOUDINARY_DELETE_ERROR: 'Error deleting from Cloudinary',
    CLOUDINARY_TRANSFORM_ERROR: 'Error transforming image',
    CLOUDINARY_CONNECTION_ERROR: 'Error connecting to Cloudinary',

    // Support Ticket Related
    INVALID_TICKET_DATA: 'Invalid ticket data provided',
    TICKET_CREATION_FAILED: 'Failed to create support ticket',
    TICKET_FETCH_FAILED: 'Failed to fetch support tickets',
  },
}; 