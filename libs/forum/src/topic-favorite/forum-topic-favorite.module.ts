import { Module } from '@nestjs/common'
import { ForumTopicFavoriteController } from './forum-topic-favorite.controller'
import { ForumTopicFavoriteService } from './forum-topic-favorite.service'

@Module({
  controllers: [ForumTopicFavoriteController],
  providers: [ForumTopicFavoriteService],
  exports: [ForumTopicFavoriteService],
})
export class ForumTopicFavoriteModule {}
