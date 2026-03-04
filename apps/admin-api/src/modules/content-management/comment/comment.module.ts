import { InteractionModule } from '@libs/interaction'
import { Module } from '@nestjs/common'
import { ContentCommentController } from './comment.controller'

@Module({
  imports: [InteractionModule],
  controllers: [ContentCommentController],
})
export class ContentCommentModule {}
