import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = unknown>(err: Error | null, user: TUser | false) {
    if (err || !user) {
      throw err ?? new UnauthorizedException('Authentication is required.');
    }

    return user;
  }
}
