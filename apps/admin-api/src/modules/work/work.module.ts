import { Module } from '@nestjs/common'
import { WorkAuthorModule } from '../content-management/author/author.module'
import { WorkCategoryModule } from '../content-management/category/category.module'
import { ContentTypeModule } from '../content-management/content-type/content-type.module'
import { WorkTagModule } from '../content-management/tag/tag.module'
import { ComicModule } from './comic/comic.module'
import { WorkComicThirdPartyModule } from './comic/third-party/third-party.module'

/**
 * 作品管理主模块
 * 统一管理作品相关的子模块
 */
@Module({
  imports: [
    ContentTypeModule,
    WorkAuthorModule,
    WorkCategoryModule,
    WorkTagModule,
    ComicModule,
    WorkComicThirdPartyModule,
  ],
  exports: [
    WorkAuthorModule,
    WorkCategoryModule,
    WorkTagModule,
    ComicModule,
    WorkComicThirdPartyModule,
  ],
})
export class WorkModule {}
