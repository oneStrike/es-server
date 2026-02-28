import { Module } from '@nestjs/common'
import { AuthModule } from './auth/auth.module'
import { DictionaryModule } from './dictionary/dictionary.module'
import { SystemModule } from './system/system.module'
import { TaskModule } from './task/task.module'
import { UserModule } from './user/user.module'
import { WorkModule } from './work/work.module'

@Module({
  imports: [
    AuthModule,
    UserModule,
    DictionaryModule,
    TaskModule,
    WorkModule,
    SystemModule,
  ],
})
export class AppApiModule {}
