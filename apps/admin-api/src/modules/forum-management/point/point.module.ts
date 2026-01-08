import { PointModule as PointModuleLib } from '@libs/forum'
import { Module } from '@nestjs/common'
import { PointController } from './point.controller'

@Module({
  imports: [PointModuleLib],
  controllers: [PointController],
  providers: [],
  exports: [],
})
export class PointModule {}
