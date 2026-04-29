import { EmojiModule } from '@libs/interaction/emoji/emoji.module'
import { Module } from '@nestjs/common'
import { BodyCompilerService } from './body-compiler.service'
import { BodyHtmlCodecService } from './body-html-codec.service'
import { BodyValidatorService } from './body-validator.service'

/**
 * 正文模块。
 * - 统一提供 canonical body 的校验与编译能力。
 */
@Module({
  imports: [EmojiModule],
  providers: [BodyCompilerService, BodyValidatorService, BodyHtmlCodecService],
  exports: [BodyCompilerService, BodyValidatorService, BodyHtmlCodecService],
})
export class BodyModule {}
