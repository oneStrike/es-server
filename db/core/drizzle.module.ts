import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { DbLifecycleService } from './db-lifecycle.service'
import { DbNotificationService } from './db-notification.service'
import {
  DrizzleDbProvider,
  DrizzlePoolProvider,
  DrizzleRuntimeConfigProvider,
} from './drizzle.provider'
import { DrizzleService } from './drizzle.service'

@Module({
  imports: [ConfigModule],
  providers: [
    DrizzleService,
    DbLifecycleService,
    DbNotificationService,
    DrizzleRuntimeConfigProvider,
    DrizzlePoolProvider,
    DrizzleDbProvider,
  ],
  exports: [DrizzleService, DbNotificationService],
})
export class DrizzleModule {}
