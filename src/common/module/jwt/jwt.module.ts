import { Module } from '@nestjs/common'
import { JwtBlacklistService } from './jwt-blacklist.service'

/**
 * JWT 公共模块
 * 提供 JWT 相关的通用服务
 */
@Module({
  providers: [JwtBlacklistService],
  exports: [JwtBlacklistService],
})
export class JwtCommonModule {}
