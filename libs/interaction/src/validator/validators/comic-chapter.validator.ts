import { Injectable } from '@nestjs/common'
import { InteractionTargetType } from '../../interaction.constant'
import { BaseTargetValidator } from './base.validator'

@Injectable()
export class ComicChapterValidator extends BaseTargetValidator {
  readonly targetType = InteractionTargetType.COMIC_CHAPTER
  protected readonly modelName = 'workChapter'

  protected getTargetName(): string {
    return '漫画章节'
  }

  async validate(targetId: number) {
    try {
      const chapter = await this.prisma.workChapter.findUnique({
        where: { id: targetId },
      })

      if (!chapter) {
        return {
          valid: false,
          message: '章节不存在',
        }
      }

      if (chapter.workType !== 1) {
        return {
          valid: false,
          message: '目标不是漫画章节',
        }
      }

      if (chapter.deletedAt !== null) {
        return {
          valid: false,
          message: '章节已被删除',
        }
      }

      return {
        valid: true,
        data: chapter,
      }
    } catch {
      return {
        valid: false,
        message: '校验章节时发生错误',
      }
    }
  }
}
