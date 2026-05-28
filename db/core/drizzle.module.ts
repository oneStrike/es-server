import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { DrizzleDbProvider, DrizzlePoolProvider } from './drizzle.provider'
import { DrizzleService } from './drizzle.service'

@Global()
@Module({
  imports: [ConfigModule],
  providers: [DrizzleService, DrizzlePoolProvider, DrizzleDbProvider],
  exports: [DrizzleService],
})
export class DrizzleModule {}
