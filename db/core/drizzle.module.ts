import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { DbLifecycleService } from './db-lifecycle.service'
import { DbNotificationService } from './db-notification.service'
import { DrizzleDbProvider, DrizzlePoolProvider } from './drizzle.provider'
import { DrizzleService } from './drizzle.service'

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    DrizzleService,
    DbLifecycleService,
    DbNotificationService,
    DrizzlePoolProvider,
    DrizzleDbProvider,
  ],
  exports: [DrizzleService, DbNotificationService],
})
export class DrizzleModule {}
