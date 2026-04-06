import { SensitiveWordModule as SensitiveWordModuleLib } from '@libs/sensitive-word/sensitive-word.module';
import { Module } from '@nestjs/common'
import { SensitiveWordController } from './sensitive-word.controller'

@Module({
  imports: [SensitiveWordModuleLib],
  controllers: [SensitiveWordController],
  providers: [],
  exports: [],
})
export class SensitiveWordModule {}
