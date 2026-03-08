import { Module } from '@nestjs/common'
import { AuthModule } from './auth/auth.module'
import { CommentModule } from './comment/comment.module'
import { DictionaryModule } from './dictionary/dictionary.module'
import { FavoriteModule } from './favorite/favorite.module'
import { LikeModule } from './like/like.module'
import { MessageModule } from './message/message.module'
import { ReportModule } from './report/report.module'
import { SystemModule } from './system/system.module'
import { TaskModule } from './task/task.module'
import { UserModule } from './user/user.module'
import { ViewModule } from './view/view.module'
import { WorkModule } from './work/work.module'

@Module({
  imports: [
    AuthModule,
    UserModule,
    DictionaryModule,
    TaskModule,
    WorkModule,
    LikeModule,
    FavoriteModule,
    ViewModule,
    SystemModule,
    CommentModule,
    MessageModule,
    ReportModule,
  ],
})
export class AppApiModule {}
