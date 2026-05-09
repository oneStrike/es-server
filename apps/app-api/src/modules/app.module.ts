import { GeoModule } from '@libs/platform/modules/geo/geo.module'
import { Module } from '@nestjs/common'
import { AuthModule } from './auth/auth.module'
import { CheckInModule } from './check-in/check-in.module'
import { CommentModule } from './comment/comment.module'
import { DictionaryModule } from './dictionary/dictionary.module'
import { DownloadModule } from './download/download.module'
import { EmojiModule } from './emoji/emoji.module'
import { FavoriteModule } from './favorite/favorite.module'
import { FollowModule } from './follow/follow.module'
import { ForumModule } from './forum/forum.module'
import { LikeModule } from './like/like.module'
import { MessageModule } from './message/message.module'
import { MonetizationModule } from './monetization/monetization.module'
import { PurchaseModule } from './purchase/purchase.module'
import { ReadingHistoryModule } from './reading-history/reading-history.module'
import { ReportModule } from './report/report.module'
import { SystemModule } from './system/system.module'
import { TaskModule } from './task/task.module'
import { UserModule } from './user/user.module'
import { WorkModule } from './work/work.module'

@Module({
  imports: [
    GeoModule,
    AuthModule,
    UserModule,
    CheckInModule,
    DictionaryModule,
    EmojiModule,
    TaskModule,
    WorkModule,
    ForumModule,
    LikeModule,
    FavoriteModule,
    FollowModule,
    ReadingHistoryModule,
    SystemModule,
    CommentModule,
    MessageModule,
    MonetizationModule,
    ReportModule,
    DownloadModule,
    PurchaseModule,
  ],
})
export class AppApiModule {}
