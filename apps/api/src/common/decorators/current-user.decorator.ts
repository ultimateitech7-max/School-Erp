import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtUser } from '../../modules/auth/strategies/jwt.strategy';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): JwtUser => {
    const request = context.switchToHttp().getRequest();
    return request.user;
  },
);

