import { ViewModule as ViewCoreModule } from '@libs/interaction/view'
import { Module } from '@nestjs/common'
import { ViewController } from './view.controller'

@Module({
  imports: [ViewCoreModule],
  controllers: [ViewController],
})
export class ViewModule {}
