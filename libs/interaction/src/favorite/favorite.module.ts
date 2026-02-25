import { Module } from '@nestjs/common'
import { FavoriteService } from './favorite.service'

@Module({
  providers: [FavoriteService],
  exports: [FavoriteService],
})
export class FavoriteModule {}
