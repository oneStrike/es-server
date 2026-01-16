import { CaptchaService, RsaService, ScryptService } from '@libs/base/modules'
import { JwtAuthModule } from '@libs/base/modules/auth'
import { ForumModule } from '@libs/forum'
import { Module } from '@nestjs/common'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'

@Module({
  controllers: [AuthController],
  imports: [JwtAuthModule, ForumModule],
  providers: [AuthService, CaptchaService, RsaService, ScryptService],
  exports: [AuthService],
})
export class AuthModule {}
