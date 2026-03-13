import { WorkModule } from '@libs/content'
import { Module } from '@nestjs/common'
import { ComicController } from './comic.controller'

@Module({
  imports: [WorkModule],
  controllers: [ComicController],
  providers: [],
  exports: [WorkModule],
})
export class ComicModule {}
