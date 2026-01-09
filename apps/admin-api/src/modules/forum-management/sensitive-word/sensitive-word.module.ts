import { SensitiveWordModule as SensitiveWordModuleLib } from '@libs/forum'
import { Module } from '@nestjs/common'

@Module({
  imports: [SensitiveWordModuleLib],
  controllers: [],
  providers: [],
  exports: [],
})
export class SensitiveWordModule {}
