/**
 * 交互模块核心入口。
 *
 * 说明：
 * - 统一聚合点赞、收藏、浏览、评论、举报、下载、购买等子模块
 * - 标记为 @Global() 以便在整个应用中共享交互服务
 */
import { Global, Module } from '@nestjs/common'
import { CommentModule } from './comment/comment.module'
import { DownloadModule } from './download/download.module'
import { FavoriteModule } from './favorite/favorite.module'
import { LikeModule } from './like/like.module'
import { PurchaseModule } from './purchase/purchase.module'
import { ReportModule } from './report/report.module'
import { ViewModule } from './view/view.module'

@Global()
@Module({
  imports: [
    LikeModule,
    FavoriteModule,
    ViewModule,
    CommentModule,
    ReportModule,
    DownloadModule,
    PurchaseModule,
  ],
  exports: [
    LikeModule,
    FavoriteModule,
    ViewModule,
    CommentModule,
    ReportModule,
    DownloadModule,
    PurchaseModule,
  ],
})
export class InteractionModule {}
