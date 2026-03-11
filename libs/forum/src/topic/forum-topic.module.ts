import { SensitiveWordModule } from '@libs/sensitive-word'
import { UserGrowthRewardModule } from '@libs/user/growth-reward'
import { MessageModule } from '@libs/message'
import { FavoriteModule } from '@libs/interaction'
import { Module } from '@nestjs/common'
import { ForumUserActionLogModule } from '../action-log/action-log.module'
import { ForumCounterModule } from '../counter/forum-counter.module'
import { ForumConfigModule } from './../config/forum-config.module'
import { ForumTopicService } from './forum-topic.service'
import { ForumTopicFavoriteResolver } from './resolver/forum-topic-favorite.resolver'

/**
 * 论坛主题模块
 * 提供论坛主题管理的完整功能
 */
@Module({
  imports: [
    UserGrowthRewardModule,
    SensitiveWordModule,
    MessageModule,
    FavoriteModule,
    ForumConfigModule,
    ForumCounterModule,
    ForumUserActionLogModule,
  ],
  controllers: [],
  providers: [ForumTopicService, ForumTopicFavoriteResolver],
  exports: [ForumTopicService, ForumTopicFavoriteResolver],
})
export class ForumTopicModule {}
