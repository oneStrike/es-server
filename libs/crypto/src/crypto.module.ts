import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { RsaService } from './rsa.service'
import { ScryptService } from './scrypt.service'

/**
 * 加密模块
 * 提供通用的加密服务，包括RSA加密和密码哈希
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [RsaService, ScryptService],
  exports: [RsaService, ScryptService],
})
export class CryptoModule {}
