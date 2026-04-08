import { Module } from '@nestjs/common'
import { Ip2regionController } from './ip2region.controller'
import { Ip2regionService } from './ip2region.service'

@Module({
  controllers: [Ip2regionController],
  providers: [Ip2regionService],
})
export class Ip2regionModule {}
