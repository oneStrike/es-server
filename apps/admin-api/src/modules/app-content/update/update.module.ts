import { AppUpdateModule as LibAppUpdateModule } from '@libs/app-content/update/update.module'
import { Module } from '@nestjs/common'
import { AppUpdateController } from './update.controller'

@Module({
  imports: [LibAppUpdateModule],
  controllers: [AppUpdateController],
})
export class AppUpdateModule {}
