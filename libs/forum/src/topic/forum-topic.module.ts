import { Module } from '@nestjs/common'
import { PointModule } from '../point/point.module'
import { ForumTopicController } from './forum-topic.controller'
import { ForumTopicService } from './forum-topic.service'

@Module({
  imports: [PointModule],
  controllers: [ForumTopicController],
  providers: [ForumTopicService],
  exports: [ForumTopicService],
})
export class ForumTopicModule {}
