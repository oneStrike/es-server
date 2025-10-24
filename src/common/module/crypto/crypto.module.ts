import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { CryptoService } from '@/common/module/crypto/crypto.service'
import { RsaService } from '@/common/module/crypto/rsa.service'

/**
 * 加密模块
 * 提供通用的加密服务，包括RSA加密和密码哈希
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [RsaService, CryptoService],
  exports: [RsaService, CryptoService],
})
export class CryptoModule {}
