import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { JwtBlacklistService } from '@/common/module/jwt/jwt-blacklist.service'
import { RsaService } from '@/common/module/jwt/rsa.service'

@Global()
@Module({
  imports: [ConfigModule],
  providers: [RsaService, JwtBlacklistService],
  exports: [RsaService, JwtBlacklistService],
})
export class JwtModule {}
