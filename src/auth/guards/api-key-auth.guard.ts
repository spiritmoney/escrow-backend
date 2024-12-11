import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { systemResponses } from '../../contracts/system.responses';

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const apiKey = request.headers['x-api-key'];

    if (!apiKey) {
      throw new UnauthorizedException(systemResponses.EN.API_KEY_MISSING);
    }

    const apiSettings = await this.prisma.apiSettings.findFirst({
      where: {
        apiKey,

        apiAccess: true,
      },

      include: {
        user: true,
      },
    });

    if (!apiSettings) {
      throw new UnauthorizedException(systemResponses.EN.API_KEY_INVALID);
    }

    if (!apiSettings.apiAccess) {
      throw new UnauthorizedException(systemResponses.EN.API_ACCESS_DISABLED);
    }

    // Attach user to request

    request.user = apiSettings.user;

    return true;
  }
}
