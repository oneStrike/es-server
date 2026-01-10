import { Module } from '@nestjs/common'
import { ForumCounterModule } from '../counter/forum-counter.module'
import { ForumTopicFavoriteController } from './forum-topic-favorite.controller'
import { ForumTopicFavoriteService } from './forum-topic-favorite.service'

@Module({
  imports: [ForumCounterModule],
  controllers: [ForumTopicFavoriteController],
  providers: [ForumTopicFavoriteService],
  exports: [ForumTopicFavoriteService],
})
export class ForumTopicFavoriteModule {}
