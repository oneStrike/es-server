import { Module } from '@nestjs/common'
import { ForumUserActionLogModule } from '../action-log/action-log.module'
import { ForumCounterModule } from '../counter/forum-counter.module'
import { ForumTopicFavoriteService } from './forum-topic-favorite.service'

@Module({
  imports: [ForumCounterModule, ForumUserActionLogModule],
  providers: [ForumTopicFavoriteService],
  exports: [ForumTopicFavoriteService],
})
export class ForumTopicFavoriteModule {}
