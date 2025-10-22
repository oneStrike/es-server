import { Module } from '@nestjs/common'
import { JwtModule as NestjsJwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { JwtModule } from '@/common/module/jwt/jwt.module'
import { adminJwtConfig } from '@/config/jwt.config'
import { AdminAuthController } from '@/modules/admin/auth/auth.controller'
import { AdminJwtAuthGuard } from './admin-jwt-auth.guard'
import { AdminJwtService } from './admin-jwt.service'
import { AdminJwtStrategy } from './admin-jwt.strategy'

@Module({
  controllers: [AdminAuthController],
  imports: [
    JwtModule,
    PassportModule.register({ defaultStrategy: 'admin-jwt' }),
    NestjsJwtModule.register({
      secret: adminJwtConfig.secret,
      signOptions: { expiresIn: adminJwtConfig.expiresIn },
    }),
  ],
  providers: [AdminJwtService, AdminJwtStrategy, AdminJwtAuthGuard],
  exports: [AdminJwtService, AdminJwtAuthGuard],
})
export class AdminAuthModule {}
