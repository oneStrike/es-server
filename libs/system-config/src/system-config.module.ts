import { CryptoModule } from '@libs/platform/modules'
import { SMS_CONFIG_PROVIDER } from '@libs/platform/modules/sms'
import { Module } from '@nestjs/common'
import { ConfigReader } from './config-reader'
import { SystemConfigService } from './system-config.service'

@Module({
  imports: [CryptoModule],
  providers: [
    ConfigReader,
    SystemConfigService,
    {
      provide: SMS_CONFIG_PROVIDER,
      useExisting: ConfigReader,
    },
  ],
  exports: [ConfigReader, SystemConfigService, SMS_CONFIG_PROVIDER],
})
export class SystemConfigModule {}
