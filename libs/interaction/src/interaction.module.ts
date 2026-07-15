/**
 * 交互模块核心入口。
 *
 * 说明：
 * - 统一聚合点赞、收藏、浏览、评论、举报、下载、钱包等静态子模块
 * - 由消费模块显式导入，保持 provider 可见性与依赖图可追踪
 */
import { Module } from '@nestjs/common'
import { BodyModule } from './body/body.module'
import { BrowseLogModule } from './browse-log/browse-log.module'
import { CommentModule } from './comment/comment.module'
import { DownloadModule } from './download/download.module'
import { EmojiModule } from './emoji/emoji.module'
import { FavoriteModule } from './favorite/favorite.module'
import { FollowModule } from './follow/follow.module'
import { LikeModule } from './like/like.module'
import { ReadingStateModule } from './reading-state/reading-state.module'
import { ReportModule } from './report/report.module'
import { WalletModule } from './wallet/wallet.module'

@Module({
  imports: [
    BodyModule,
    LikeModule,
    FavoriteModule,
    FollowModule,
    EmojiModule,
    BrowseLogModule,
    ReadingStateModule,
    CommentModule,
    ReportModule,
    DownloadModule,
    WalletModule,
  ],
  exports: [
    BodyModule,
    LikeModule,
    FavoriteModule,
    FollowModule,
    EmojiModule,
    BrowseLogModule,
    ReadingStateModule,
    CommentModule,
    ReportModule,
    DownloadModule,
    WalletModule,
  ],
})
export class InteractionModule {}
