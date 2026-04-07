import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuditService } from '../audit/audit.service';
import { UserWithRole, UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async login(
    dto: LoginDto,
    requestContext?: { ipAddress?: string; userAgent?: string | string[] },
  ) {
    const user = await this.validateUser(dto.email, dto.password);

    await this.usersService.touchLastLogin(user.id);

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role.roleType,
      roleCode: user.role.roleCode,
      schoolId: user.schoolId,
    };

    const permissions = this.usersService.getPermissionCodes(user);
    const expiresIn = this.configService.get<string>('JWT_EXPIRES_IN', '1d');

    await this.auditService.write({
      action: 'auth.login',
      entity: 'user',
      entityId: user.id,
      actorUserId: user.id,
      schoolId: user.schoolId,
      metadata: {
        ipAddress: requestContext?.ipAddress ?? null,
        userAgent: requestContext?.userAgent ?? null,
      },
    });

    return {
      accessToken: await this.jwtService.signAsync(payload),
      tokenType: 'Bearer',
      expiresIn,
      permissions,
      user: this.usersService.toSafeUser(user),
    };
  }

  async getProfile(userId: string) {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnauthorizedException('Invalid token.');
    }

    return {
      user: this.usersService.toSafeUser(user),
      permissions: this.usersService.getPermissionCodes(user),
    };
  }

  private async validateUser(
    email: string,
    password: string,
  ): Promise<UserWithRole> {
    const user = await this.usersService.findByEmail(email);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    return user;
  }
}
