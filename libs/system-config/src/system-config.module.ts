import { CryptoModule } from '@libs/base/modules'
import { Module } from '@nestjs/common'
import { SystemConfigService } from './system-config.service'

@Module({
  imports: [CryptoModule],
  providers: [SystemConfigService],
  exports: [SystemConfigService],
})
export class SystemConfigModule {}
