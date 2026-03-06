import { CryptoModule } from '@libs/base/modules'
import { Module } from '@nestjs/common'
import { ConfigReader } from './config-reader'
import { SystemConfigService } from './system-config.service'

@Module({
  imports: [CryptoModule],
  providers: [ConfigReader, SystemConfigService],
  exports: [ConfigReader, SystemConfigService],
})
export class SystemConfigModule {}
