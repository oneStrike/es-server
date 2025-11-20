import { Module } from '@nestjs/common'
import { JwtModule as NestjsJwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { JwtCommonModule } from '@/common/module/jwt/jwt.module'
import { CLIENT_AUTH_CONFIG } from '@/config/jwt.config'
import { ClientJwtService } from './client-jwt.service'
import { ClientJwtStrategy } from './client-jwt.strategy'

@Module({
  imports: [
    JwtCommonModule, // 导入 JWT 公共模块
    PassportModule.register({
      defaultStrategy: CLIENT_AUTH_CONFIG.strategyKey,
    }),
    NestjsJwtModule.register({
      secret: CLIENT_AUTH_CONFIG.secret,
      signOptions: { expiresIn: CLIENT_AUTH_CONFIG.expiresIn },
    }),
  ],
  providers: [ClientJwtService, ClientJwtStrategy],
  exports: [ClientJwtService],
})
export class ClientAuthModule {}
