import { BaseAuthModule } from '@libs/auth'
import { Module } from '@nestjs/common'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'

@Module({
  controllers: [AuthController],
  imports: [BaseAuthModule],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
