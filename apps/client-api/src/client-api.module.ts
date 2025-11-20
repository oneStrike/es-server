import { Module } from '@nestjs/common';
import { ClientApiController } from './client-api.controller';
import { ClientApiService } from './client-api.service';

@Module({
  imports: [],
  controllers: [ClientApiController],
  providers: [ClientApiService],
})
export class ClientApiModule {}
