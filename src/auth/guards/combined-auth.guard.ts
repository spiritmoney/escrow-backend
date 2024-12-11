import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ApiKeyAuthGuard } from './api-key-auth.guard';
import { systemResponses } from '../../contracts/system.responses';
import { ConfigService } from '@nestjs/config';
import { Observable, from } from 'rxjs';

@Injectable()
export class CombinedAuthGuard extends JwtAuthGuard {
  constructor(
    private apiKeyGuard: ApiKeyAuthGuard,
    private configService: ConfigService,
  ) {
    super();
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const isApiRequest = this.isApiIntegrationRequest(request);

    // For API integration requests, only allow API key authentication
    if (isApiRequest) {
      const hasJwtToken = request.headers.authorization?.startsWith('Bearer ');
      if (hasJwtToken) {
        throw new UnauthorizedException(
          systemResponses.EN.API_INTEGRATION_AUTH_REQUIRED,
        );
      }
      return this.apiKeyGuard.canActivate(context);
    }

    // For web app requests, only allow JWT authentication
    const hasApiKey = !!request.headers['x-api-key'];
    if (hasApiKey) {
      throw new UnauthorizedException(
        systemResponses.EN.JWT_AUTHENTICATION_REQUIRED,
      );
    }

    try {
      return super.canActivate(context);
    } catch (error) {
      throw new UnauthorizedException(systemResponses.EN.AUTHENTICATION_FAILED);
    }
  }

  private isApiIntegrationRequest(request: any): boolean {
    const origin = request.headers.origin || request.headers.referer;
    const webAppOrigins = this.configService.get('webAppOrigins');

    // If no origin or doesn't match web app origins, treat as API integration request
    if (!origin) return true;

    return !webAppOrigins.some((allowedOrigin) => {
      if (allowedOrigin instanceof RegExp) {
        return allowedOrigin.test(origin);
      }
      return origin.startsWith(allowedOrigin);
    });
  }
}
