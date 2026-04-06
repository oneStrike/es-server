import { CryptoModule } from '@libs/platform/modules/crypto/crypto.module';
import { SMS_CONFIG_PROVIDER } from '@libs/platform/modules/sms/sms.types';
import { UPLOAD_CONFIG_PROVIDER } from '@libs/platform/modules/upload/upload.types'
import { Module } from '@nestjs/common'
import { ConfigReader } from './config-reader'
import { SystemConfigService } from './system-config.service'

/**
 * 系统配置模块
 * 提供系统配置的管理和读取功能
 */
@Module({
  imports: [CryptoModule],
  providers: [
    ConfigReader,
    SystemConfigService,
    {
      provide: SMS_CONFIG_PROVIDER,
      useExisting: ConfigReader,
    },
    {
      provide: UPLOAD_CONFIG_PROVIDER,
      useExisting: ConfigReader,
    },
  ],
  exports: [
    ConfigReader,
    SystemConfigService,
    SMS_CONFIG_PROVIDER,
    UPLOAD_CONFIG_PROVIDER,
  ],
})
export class SystemConfigModule {}
