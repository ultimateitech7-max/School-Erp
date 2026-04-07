import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { RoleType } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: RoleType;
  roleCode: string;
  schoolId: string | null;
}

export interface JwtUser {
  id: string;
  email: string;
  name: string;
  role: RoleType;
  roleCode: string;
  schoolId: string | null;
  permissions: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtUser> {
    const user = await this.usersService.findById(payload.sub);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid token.');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.fullName,
      role: user.role.roleType,
      roleCode: user.role.roleCode,
      schoolId: user.schoolId,
      permissions: this.usersService.getPermissionCodes(user),
    };
  }
}
