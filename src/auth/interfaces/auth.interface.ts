export interface IAuthService {
  validateUser(email: string, password: string): Promise<any>;
  login(user: any): Promise<LoginResponse>;
  register(userData: RegisterDto): Promise<RegisterResponse>;
  verifyOTP(verifyOtpDto: any): Promise<{ message: string }>;
  requestPasswordReset(email: string): Promise<{ message: string }>;
  resetPassword(resetPasswordDto: any): Promise<{ message: string }>;
}

export interface IUserRepository {
  findByEmail(email: string): Promise<any>;
  findById(id: string): Promise<any>;
  create(userData: any, walletAddress: string): Promise<any>;
  updateWalletAddress(userId: string, walletAddress: string): Promise<any>;
  updateResetOTP(userId: string, otp: string, otpExpiry: Date): Promise<any>;
  updatePassword(userId: string, hashedPassword: string): Promise<any>;
  verifyEmail(userId: string): Promise<any>;
}

export interface LoginResponse {
  access_token: string;
  api_key?: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    organisation: string;
    role: string;
    walletAddress: string;
  };
}

export interface RegisterResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    organisation: string;
    role: string;
    walletAddress: string;
  };
  wallet: {
    address: string;
    encryptedPrivateKey: string;
    iv: string;
  };
  apiKey: string;
  message: string;
}

export interface RegisterDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  country: string;
  organisation: string;
  role: string;
} 