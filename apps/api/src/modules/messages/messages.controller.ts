import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtUser } from '../auth/strategies/jwt.strategy';
import { CreateMessageDto } from './dto/create-message.dto';
import { MessagesService } from './messages.service';

@Controller('messages')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  RoleType.SUPER_ADMIN,
  RoleType.SCHOOL_ADMIN,
  RoleType.TEACHER,
  RoleType.STAFF,
  RoleType.PARENT,
  RoleType.STUDENT,
)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  create(@CurrentUser() currentUser: JwtUser, @Body() dto: CreateMessageDto) {
    return this.messagesService.create(currentUser, dto);
  }

  @Get('inbox')
  findInbox(@CurrentUser() currentUser: JwtUser) {
    return this.messagesService.findInbox(currentUser);
  }

  @Get('sent')
  findSent(@CurrentUser() currentUser: JwtUser) {
    return this.messagesService.findSent(currentUser);
  }

  @Get('recipients')
  findRecipients(
    @CurrentUser() currentUser: JwtUser,
    @Query('schoolId') schoolId?: string,
    @Query('role') role?: string,
  ) {
    return this.messagesService.findRecipients(currentUser, schoolId ?? null, role ?? null);
  }

  @Patch(':id/read')
  markRead(@CurrentUser() currentUser: JwtUser, @Param('id') id: string) {
    return this.messagesService.markRead(currentUser, id);
  }

  @Delete('thread/:otherUserId')
  removeThread(
    @CurrentUser() currentUser: JwtUser,
    @Param('otherUserId') otherUserId: string,
  ) {
    return this.messagesService.removeThread(currentUser, otherUserId);
  }

  @Delete(':id')
  remove(@CurrentUser() currentUser: JwtUser, @Param('id') id: string) {
    return this.messagesService.remove(currentUser, id);
  }
}
