import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRepository } from '../repositories/user.repository';
import { SystemConfigDTO } from '../../config/configuration';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private userRepository: UserRepository,
    private configService: ConfigService,
  ) {
    const secret = configService.get<string>(SystemConfigDTO.JWT_SECRET);
    if (!secret || secret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters long');
    }
    
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: any) {
    if (!payload) {
      throw new UnauthorizedException('Invalid token format');
    }

    const user = await this.userRepository.findByEmail(payload.email);
    if (!user || user.id !== payload.sub) {
      throw new UnauthorizedException('Invalid token or user not found');
    }
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      organisation: payload.organisation
    };
  }
} 