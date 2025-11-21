import { Module } from '@nestjs/common'
import { AuthService } from './auth.service'
import { JwtBlacklistService } from './jwt-blacklist.service'

@Module({
  providers: [AuthService, JwtBlacklistService],
  exports: [AuthService, JwtBlacklistService],
})
export class BaseAuthModule {}
