import { WorkChapterModule } from '@libs/content/work/chapter'
import { WorkCommentModule } from '@libs/content/work/comment'
import { WorkModule as WorkCoreModule } from '@libs/content/work/core'
import { Module } from '@nestjs/common'
import { ProfileController } from './profile.controller'

@Module({
  imports: [WorkCoreModule, WorkChapterModule, WorkCommentModule],
  controllers: [ProfileController],
})
export class ProfileModule {}
