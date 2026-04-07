import { Module } from '@nestjs/common';
import { ModulesControlController } from './modules-control.controller';
import { ModulesControlService } from './modules-control.service';

@Module({
  controllers: [ModulesControlController],
  providers: [ModulesControlService],
  exports: [ModulesControlService],
})
export class ModulesControlModule {}

