import { UploadModule } from '@libs/base/modules'
import { Module } from '@nestjs/common'
import { ComicContentService } from './comic-content.service'
import { NovelContentService } from './novel-content.service'

@Module({
  imports: [UploadModule],
  providers: [ComicContentService, NovelContentService],
  exports: [ComicContentService, NovelContentService],
})
export class ContentModule {}
