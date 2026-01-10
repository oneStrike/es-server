import { Module } from '@nestjs/common'
import { ForumCounterModule } from '../counter/forum-counter.module'
import { PointModule } from '../point/point.module'
import { SensitiveWordModule } from '../sensitive-word/sensitive-word.module'
import { ForumConfigModule } from './../config/forum-config.module'
import { ForumTopicService } from './forum-topic.service'

/**
 * 论坛主题模块
 * 提供论坛主题管理的完整功能
 */
@Module({
  imports: [PointModule, SensitiveWordModule, ForumConfigModule, ForumCounterModule],
  controllers: [],
  providers: [ForumTopicService],
  exports: [ForumTopicService],
})
export class ForumTopicModule {}
