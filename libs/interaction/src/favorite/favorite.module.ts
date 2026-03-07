import { MessageModule } from '@libs/message'
import { Module } from '@nestjs/common'
import { FavoriteService } from './favorite.service'

@Module({
  imports: [MessageModule],
  providers: [FavoriteService],
  exports: [FavoriteService],
})
export class FavoriteModule {}
