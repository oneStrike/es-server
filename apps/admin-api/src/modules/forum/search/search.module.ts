import { ForumSearchModule as ForumSearchModuleLib } from '@libs/forum/search'
import { Module } from '@nestjs/common'
import { ForumSearchController } from './search.controller'

@Module({
  imports: [ForumSearchModuleLib],
  controllers: [ForumSearchController],
})
export class ForumSearchModule {}
