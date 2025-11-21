import { BaseAuthModule } from '@libs/auth'
import { Module } from '@nestjs/common'
import { JwtModule as NestjsJwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { ADMIN_AUTH_CONFIG } from '../../../config/jwt.config'
import { AdminAuthController } from './auth.controller'
import { AdminAuthService } from './auth.service'

@Module({
  controllers: [AdminAuthController],
  imports: [
    BaseAuthModule, // 导入 JWT 公共模块
    PassportModule.register({ defaultStrategy: ADMIN_AUTH_CONFIG.strategyKey }),
    NestjsJwtModule.register({
      secret: ADMIN_AUTH_CONFIG.secret,
      signOptions: { expiresIn: ADMIN_AUTH_CONFIG.expiresIn },
    }),
  ],
  providers: [AdminAuthService],
  exports: [AdminAuthService],
})
export class AdminAuthModule {}
