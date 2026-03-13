import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import {
  DrizzleDbLegacyProvider,
  DrizzleDbProvider,
  DrizzlePoolProvider,
} from './drizzle.provider'
import { DrizzleService } from './drizzle.service'

@Module({
  imports: [ConfigModule],
  providers: [
    DrizzleService,
    DrizzlePoolProvider,
    DrizzleDbProvider,
    DrizzleDbLegacyProvider,
  ],
  exports: [
    DrizzleService,
    DrizzlePoolProvider,
    DrizzleDbProvider,
    DrizzleDbLegacyProvider,
  ],
})
export class DrizzleModule {}
