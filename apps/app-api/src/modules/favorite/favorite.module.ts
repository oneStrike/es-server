import { FavoriteModule as FavoriteCoreModule } from '@libs/interaction/favorite'
import { Module } from '@nestjs/common'
import { FavoriteController } from './favorite.controller'

@Module({
  imports: [FavoriteCoreModule],
  controllers: [FavoriteController],
})
export class FavoriteModule {}
