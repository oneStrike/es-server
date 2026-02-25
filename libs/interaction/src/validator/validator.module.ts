import { Global, Module, OnModuleInit } from '@nestjs/common'
import { PrismaClient } from '@libs/base/database'
import { TargetValidatorRegistry } from './target-validator.registry'
import {
  ComicValidator,
  NovelValidator,
  ComicChapterValidator,
  NovelChapterValidator,
  ForumTopicValidator,
} from './validators'

/**
 * 目标校验器模块
 * 提供所有目标类型的校验器
 */
@Global()
@Module({
  providers: [
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
  ) {}

  onModuleInit() {
    // 注册所有校验器
    this.registry.register(this.comicValidator)
    this.registry.register(this.novelValidator)
    this.registry.register(this.comicChapterValidator)
    this.registry.register(this.novelChapterValidator)
    this.registry.register(this.forumTopicValidator)
  }
}
