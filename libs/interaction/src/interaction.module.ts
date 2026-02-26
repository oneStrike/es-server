import { Global, Module } from '@nestjs/common'
import { CommentLikeModule } from './comment-like/comment-like.module'
import { CommentReportModule } from './comment-report/comment-report.module'
import { CommentModule } from './comment/comment.module'
import { CounterModule } from './counter/counter.module'
import { DownloadModule } from './download/download.module'
import { FavoriteModule } from './favorite/favorite.module'
import { InteractionEventEmitter } from './interaction.event'
import { LikeModule } from './like/like.module'
import { PurchaseModule } from './purchase/purchase.module'
import { ValidatorModule } from './validator/validator.module'
import { ViewModule } from './view/view.module'

@Global()
@Module({
  imports: [
    ValidatorModule,
    CounterModule,
    LikeModule,
    FavoriteModule,
    ViewModule,
    CommentModule,
    CommentLikeModule,
    CommentReportModule,
    DownloadModule,
    PurchaseModule,
  ],
  providers: [InteractionEventEmitter],
  exports: [
    ValidatorModule,
    CounterModule,
    LikeModule,
    FavoriteModule,
    ViewModule,
    CommentModule,
    CommentLikeModule,
    CommentReportModule,
    DownloadModule,
    PurchaseModule,
    InteractionEventEmitter,
  ],
})
export class InteractionModule {}
