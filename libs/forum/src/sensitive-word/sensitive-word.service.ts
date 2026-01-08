import { BaseService } from '@libs/base/database'
import { IdDto, UpdateEnabledStatusDto } from '@libs/base/dto'
import { Injectable } from '@nestjs/common'
import {
  CreateSensitiveWordDto,
  QuerySensitiveWordDto,
  UpdateSensitiveWordDto,
} from './dto/sensitive-word.dto'

@Injectable()
export class SensitiveWordService extends BaseService {
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
        ...dto,
        word: {
          contains: dto.word,
        },
      },
    })
  }

  /**
   * 创建敏感词
   */
  async createSensitiveWord(dto: CreateSensitiveWordDto) {
    // 检查敏感词是否已存在
    const existingWord = await this.sensitiveWord.findFirst({
      where: {
        word: dto.word,
      },
    })
    if (existingWord) {
      this.throwHttpException('敏感词已存在')
    }
    return this.sensitiveWord.create({
      data: dto,
    })
  }

  /**
   * 更新敏感词
   */
  async updateSensitiveWord(dto: UpdateSensitiveWordDto) {
    // 检查敏感词是否已存在
    const existingWord = await this.sensitiveWord.findFirst({
      where: {
        word: dto.word,
      },
      select: { id: true },
    })
    if (existingWord && existingWord.id !== dto.id) {
      this.throwHttpException('敏感词已存在')
    }

    await this.checkDataExists(dto.id, this.sensitiveWord)

    return this.sensitiveWord.update({
      where: {
        id: dto.id,
      },
      data: dto,
    })
  }

  /**
   * 删除敏感词
   */
  async deleteSensitiveWord(dto: IdDto) {
    await this.checkDataExists(dto.id, this.sensitiveWord)
    return this.sensitiveWord.delete({
      where: {
        id: dto.id,
      },
    })
  }

  /**
   * 更新敏感词状态
   */
  async updateSensitiveWordStatus(dto: UpdateEnabledStatusDto) {
    await this.checkDataExists(dto.id, this.sensitiveWord)
    return this.sensitiveWord.update({
      where: {
        id: dto.id,
      },
      data: dto,
    })
  }
}
