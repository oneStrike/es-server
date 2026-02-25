import { PrismaClient } from '@libs/base/database'
import { Global, Module, OnModuleInit } from '@nestjs/common'
import { TargetValidatorRegistry } from './target-validator.registry'
import {
  ComicChapterValidator,
  ComicValidator,
  ForumTopicValidator,
  NovelChapterValidator,
  NovelValidator,
} from './validators'

@Global()
@Module({
  providers: [
    PrismaClient,
    TargetValidatorRegistry,
    ComicValidator,
    NovelValidator,
    ComicChapterValidator,
    NovelChapterValidator,
    ForumTopicValidator,
  ],
  exports: [TargetValidatorRegistry],
})
export class ValidatorModule implements OnModuleInit {
  constructor(
    private readonly registry: TargetValidatorRegistry,
    private readonly comicValidator: ComicValidator,
    private readonly novelValidator: NovelValidator,
    private readonly comicChapterValidator: ComicChapterValidator,
    private readonly novelChapterValidator: NovelChapterValidator,
    private readonly forumTopicValidator: ForumTopicValidator,
  ) { }

  onModuleInit() {
    this.registry.register(this.comicValidator)
    this.registry.register(this.novelValidator)
    this.registry.register(this.comicChapterValidator)
    this.registry.register(this.novelChapterValidator)
    this.registry.register(this.forumTopicValidator)
  }
}
