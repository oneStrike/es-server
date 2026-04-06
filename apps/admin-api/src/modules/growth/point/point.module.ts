import { UserPointModule } from '@libs/growth/point/point.module';
import { Module } from '@nestjs/common'
import { PointController } from './point.controller'

@Module({
  imports: [UserPointModule],
  controllers: [PointController],
  providers: [],
  exports: [],
})
export class PointModule {}
