import { Module } from '@nestjs/common'
import { UserAssetsService } from './user-assets.service'

@Module({
  providers: [UserAssetsService],
  exports: [UserAssetsService],
})
export class UserAssetsModule {}
