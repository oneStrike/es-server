import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import {
  DRIZZLE_POOL,
  DrizzleDbProvider,
  DrizzlePoolProvider,
} from './drizzle.provider'
import { DrizzleService } from './drizzle.service'

@Global()
@Module({
  imports: [ConfigModule],
  providers: [DrizzleService, DrizzlePoolProvider, DrizzleDbProvider],
  exports: [DrizzleService, DRIZZLE_POOL],
})
export class DrizzleModule {}
