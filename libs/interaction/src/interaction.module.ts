import { Module, Global } from '@nestjs/common'
import { LikeModule } from './like/like.module'
import { FavoriteModule } from './favorite/favorite.module'
import { ViewModule } from './view/view.module'
import { CommentModule } from './comment/comment.module'
import { CommentLikeModule } from './comment-like/comment-like.module'
import { CommentReportModule } from './comment-report/comment-report.module'
import { DownloadModule } from './download/download.module'
import { CounterModule } from './counter/counter.module'
import { ValidatorModule } from './validator/validator.module'
import { InteractionEventEmitter } from './interaction.event'

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
    InteractionEventEmitter,
  ],
})
export class InteractionModule {}
