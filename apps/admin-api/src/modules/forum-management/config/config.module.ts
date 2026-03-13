import { ForumConfigModule as ForumConfigModuleLib } from '@libs/forum'
import { Module } from '@nestjs/common'
import { ForumConfigController } from './config.controller'

@Module({
  imports: [ForumConfigModuleLib],
  controllers: [ForumConfigController],
  providers: [],
  exports: [],
})
export class ForumConfigModule {}
