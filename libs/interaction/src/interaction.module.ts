/**
 * 交互模块核心入口。
 *
 * 说明：
 * - 统一聚合点赞、收藏、浏览、评论、举报、下载、购买等子模块
 * - 标记为 @Global() 以便在整个应用中共享交互服务
 */
import { Global, Module } from '@nestjs/common'
import { AdRewardModule } from './ad-reward/ad-reward.module'
import { BodyModule } from './body/body.module'
import { BrowseLogModule } from './browse-log/browse-log.module'
import { CommentModule } from './comment/comment.module'
import { CouponModule } from './coupon/coupon.module'
import { DownloadModule } from './download/download.module'
import { EmojiModule } from './emoji/emoji.module'
import { FavoriteModule } from './favorite/favorite.module'
import { FollowModule } from './follow/follow.module'
import { LikeModule } from './like/like.module'
import { MembershipModule } from './membership/membership.module'
import { PaymentModule } from './payment/payment.module'
import { PurchaseModule } from './purchase/purchase.module'
import { ReadingStateModule } from './reading-state/reading-state.module'
import { ReportModule } from './report/report.module'
import { UserAssetsModule } from './user-assets/user-assets.module'
import { WalletModule } from './wallet/wallet.module'

@Global()
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
    CouponModule,
    PaymentModule,
    MembershipModule,
    AdRewardModule,
    PurchaseModule,
    UserAssetsModule,
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
    CouponModule,
    PaymentModule,
    MembershipModule,
    AdRewardModule,
    PurchaseModule,
    UserAssetsModule,
  ],
})
export class InteractionModule {}
