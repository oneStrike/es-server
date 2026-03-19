import { ForumModule as ForumCoreModule } from '@libs/forum'
import { Module } from '@nestjs/common'
import { ForumController } from './forum.controller'

@Module({
  imports: [ForumCoreModule],
  controllers: [ForumController],
})
export class ForumModule {}
