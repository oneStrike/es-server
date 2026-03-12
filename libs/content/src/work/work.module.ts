import { UploadModule } from '@libs/base/modules'
import { InteractionModule } from '@libs/interaction'
import { UserPermissionModule } from '@libs/user/permission'
import { UserPointModule } from '@libs/user/point'
import { Module } from '@nestjs/common'
import { ContentPermissionModule } from '../permission'
import { WorkComicChapterLikeResolver } from './chapter/resolver/work-comic-chapter-like.resolver'
import { WorkNovelChapterLikeResolver } from './chapter/resolver/work-novel-chapter-like.resolver'
import { WorkChapterService } from './chapter/work-chapter.service'
import { ComicContentService } from './content/comic-content.service'
import { NovelContentService } from './content/novel-content.service'
import { WorkComicFavoriteResolver } from './core/resolver/work-comic-favorite.resolver'
import { WorkComicLikeResolver } from './core/resolver/work-comic-like.resolver'
import { WorkNovelFavoriteResolver } from './core/resolver/work-novel-favorite.resolver'
import { WorkNovelLikeResolver } from './core/resolver/work-novel-like.resolver'
import { WorkService } from './core/work.service'

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
    WorkComicLikeResolver,
    WorkNovelLikeResolver,
    WorkComicChapterLikeResolver,
    WorkNovelChapterLikeResolver,
  ],
  exports: [
    WorkService,
    WorkChapterService,
    NovelContentService,
    ComicContentService,
  ],
})
export class WorkModule {}
