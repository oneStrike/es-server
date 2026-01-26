import { Module } from '@nestjs/common'
import { ForumUserActionLogModule } from '../action-log/action-log.module'
import { ForumCounterModule } from '../counter/forum-counter.module'
import { ForumPointModule } from '@libs/user/point'
import { ForumSensitiveWordModule } from '../sensitive-word/sensitive-word.module'
import { ForumConfigModule } from './../config/forum-config.module'
import { ForumTopicService } from './forum-topic.service'

/**
 * 论坛主题模块
 * 提供论坛主题管理的完整功能
 */
@Module({
  imports: [ForumPointModule, ForumSensitiveWordModule, ForumConfigModule, ForumCounterModule, ForumUserActionLogModule],
  controllers: [],
  providers: [ForumTopicService],
  exports: [ForumTopicService],
})
export class ForumTopicModule {}
