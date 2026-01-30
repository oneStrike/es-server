import { SystemConfigModule as LibSystemConfigModule } from '@libs/system-config'
import { Module } from '@nestjs/common'
import { SystemConfigController } from './system-config.controller'

@Module({
  imports: [LibSystemConfigModule],
  controllers: [SystemConfigController],
})
export class SystemConfigModule {}
