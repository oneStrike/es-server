import { Global, Module } from '@nestjs/common'
import { CommentModule } from './comment/comment.module'
import { CounterModule } from './counter/counter.module'
import { DownloadModule } from './download/download.module'
import { FavoriteModule } from './favorite/favorite.module'
import { LikeModule } from './like/like.module'
import { PurchaseModule } from './purchase/purchase.module'
import { ReportModule } from './report/report.module'
import { ViewModule } from './view/view.module'

@Global()
@Module({
  imports: [
    CounterModule,
    LikeModule,
    FavoriteModule,
    ViewModule,
    CommentModule,
    ReportModule,
    DownloadModule,
    PurchaseModule,
  ],
  exports: [
    CounterModule,
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
