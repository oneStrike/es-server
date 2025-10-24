import { Module } from '@nestjs/common'
import { JwtModule as NestjsJwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { JwtCommonModule } from '@/common/module/jwt/jwt.module'
import { ADMIN_AUTH_CONFIG } from '@/config/jwt.config'
import { AdminAuthController } from '@/modules/admin/auth/auth.controller'
import { SharedModule } from '@/modules/shared/shared.module'
import { AdminJwtService } from './admin-jwt.service'
import { AdminJwtStrategy } from './admin-jwt.strategy'
import { AdminAuthService } from './auth.service'

@Module({
  controllers: [AdminAuthController],
  imports: [
    JwtCommonModule, // 导入 JWT 公共模块
    PassportModule.register({ defaultStrategy: ADMIN_AUTH_CONFIG.strategyKey }),
    NestjsJwtModule.register({
      secret: ADMIN_AUTH_CONFIG.secret,
      signOptions: { expiresIn: ADMIN_AUTH_CONFIG.expiresIn },
    }),
    SharedModule, // 导入共享模块以获取 RequestLogService
  ],
  providers: [AdminJwtService, AdminJwtStrategy, AdminAuthService],
  exports: [AdminJwtService, AdminAuthService],
})
export class AdminAuthModule {}
