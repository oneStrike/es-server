import { EmojiModule } from '@libs/interaction/emoji/emoji.module'
import { Module } from '@nestjs/common'
import { BodyCompilerService } from './body-compiler.service'
import { BodyValidatorService } from './body-validator.service'

/**
 * 正文模块。
 * - 统一提供 canonical body 的校验与编译能力。
 */
@Module({
  imports: [EmojiModule],
  providers: [BodyCompilerService, BodyValidatorService],
  exports: [BodyCompilerService, BodyValidatorService],
})
export class BodyModule {}
