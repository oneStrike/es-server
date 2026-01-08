import { ModeratorModule as ModeratorModuleLib } from '@libs/forum'
import { Module } from '@nestjs/common'
import { ModeratorController } from './moderator.controller'

@Module({
  imports: [ModeratorModuleLib],
  controllers: [ModeratorController],
  providers: [],
  exports: [],
})
export class ModeratorModule {}
