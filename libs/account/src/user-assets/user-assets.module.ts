import { DrizzleModule } from '@db/core'
import { Module } from '@nestjs/common'
import { UserAssetsService } from './user-assets.service'

/** 账户中心跨资产读取模型的唯一 Nest provider owner。 */
@Module({
  imports: [DrizzleModule],
  providers: [UserAssetsService],
  exports: [UserAssetsService],
})
export class UserAssetsModule {}
