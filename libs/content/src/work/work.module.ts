import { UploadModule } from '@libs/base/modules'
import { InteractionModule } from '@libs/interaction'
import { UserPermissionModule } from '@libs/user/permission'
import { UserPointModule } from '@libs/user/point'
import { Module } from '@nestjs/common'
import { ContentPermissionModule } from '../permission'
import { WorkChapterService } from './chapter/work-chapter.service'
import { ComicContentService } from './content/comic-content.service'
import { NovelContentService } from './content/novel-content.service'
import { WorkService } from './core/work.service'
import { WorkComicFavoriteResolver } from './core/resolver/work-comic-favorite.resolver'
import { WorkNovelFavoriteResolver } from './core/resolver/work-novel-favorite.resolver'

@Module({
  imports: [
    InteractionModule,
    UserPermissionModule,
    ContentPermissionModule,
    UserPointModule,
    UploadModule,
  ],
  providers: [
    WorkService,
    WorkChapterService,
    NovelContentService,
    ComicContentService,
    WorkComicFavoriteResolver,
    WorkNovelFavoriteResolver,
  ],
  exports: [
    WorkService,
    WorkChapterService,
    NovelContentService,
    ComicContentService,
  ],
})
export class WorkModule {}
