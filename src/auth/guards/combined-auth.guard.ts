import { Injectable, ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ApiKeyAuthGuard } from './api-key-auth.guard';

@Injectable()
export class CombinedAuthGuard extends JwtAuthGuard {
  constructor(private apiKeyGuard: ApiKeyAuthGuard) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      // First try JWT authentication
      const canActivateJwt = await super.canActivate(context);
      if (canActivateJwt) {
        return true;
      }
    } catch {
      // If JWT fails, try API key authentication
      return this.apiKeyGuard.canActivate(context);
    }

    return false;
  }
} 