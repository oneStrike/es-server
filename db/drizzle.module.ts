import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { DrizzleDbProvider, DrizzleService } from './drizzle.provider'

@Module({
  imports: [ConfigModule],
  providers: [DrizzleService, DrizzleDbProvider],
  exports: [DrizzleService, DrizzleDbProvider],
})
export class DrizzleModule {}
