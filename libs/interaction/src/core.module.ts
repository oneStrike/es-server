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
