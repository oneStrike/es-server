import { RepositoryService } from '@libs/base/database'
import { Injectable } from '@nestjs/common'
import { QuerySensitiveWordDto } from './dto/sensitive-word.dto'

@Injectable()
export class SensitiveWordService extends RepositoryService {
  constructor() {
    super()
  }

  get sensitiveWord() {
    return this.prisma.forumSensitiveWord
  }

  /**
   * 获取敏感词列表
   */
  async getSensitiveWordPage(dto: QuerySensitiveWordDto) {
    return this.sensitiveWord.findPagination({
      where: {
        word: {
          contains: dto.word,
        },
        isEnabled: dto.isEnabled,
      },
    })
  }
}
