import { ForumSensitiveWordModule as SensitiveWordModuleLib } from '@libs/forum/sensitive-word'
import { Module } from '@nestjs/common'
import { SensitiveWordController } from './sensitive-word.controller'

@Module({
  imports: [SensitiveWordModuleLib],
  controllers: [SensitiveWordController],
  providers: [],
  exports: [],
})
export class SensitiveWordModule {}
