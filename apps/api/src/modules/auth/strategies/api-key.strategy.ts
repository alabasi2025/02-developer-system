import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { Request } from 'express';
import { AuthService } from '../auth.service';

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(Strategy, 'api-key') {
  constructor(private readonly authService: AuthService) {
    super();
  }

  async validate(req: Request) {
    const apiKey = this.extractApiKey(req);
    
    if (!apiKey) {
      throw new UnauthorizedException('API key is required');
    }

    const user = await this.authService.validateApiKey(apiKey);
    
    if (!user) {
      throw new UnauthorizedException('Invalid API key');
    }

    return user;
  }

  private extractApiKey(req: Request): string | null {
    // Try X-API-Key header first
    const headerKey = req.headers['x-api-key'];
    if (headerKey && typeof headerKey === 'string') {
      return headerKey;
    }

    // Try Authorization header with ApiKey scheme
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('ApiKey ')) {
      return authHeader.substring(7);
    }

    // Try query parameter
    const queryKey = req.query['api_key'];
    if (queryKey && typeof queryKey === 'string') {
      return queryKey;
    }

    return null;
  }
}
