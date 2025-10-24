import { Module } from '@nestjs/common'
import { JwtModule as NestjsJwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { JwtModule } from '@/common/module/jwt/jwt.module'
import { ADMIN_AUTH_CONFIG } from '@/config/jwt.config'
import { AdminAuthController } from '@/modules/admin/auth/auth.controller'
import { AdminJwtService } from './admin-jwt.service'
import { AdminJwtStrategy } from './admin-jwt.strategy'

@Module({
  controllers: [AdminAuthController],
  imports: [
    JwtModule,
    PassportModule.register({ defaultStrategy: ADMIN_AUTH_CONFIG.strategyKey }),
    NestjsJwtModule.register({
      secret: ADMIN_AUTH_CONFIG.secret,
      signOptions: { expiresIn: ADMIN_AUTH_CONFIG.expiresIn },
    }),
  ],
  providers: [AdminJwtService, AdminJwtStrategy],
  exports: [AdminJwtService],
})
export class AdminAuthModule {}
