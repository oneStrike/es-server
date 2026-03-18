import { BadRequestException, Injectable } from '@nestjs/common'

import {
  DetailComicRequestDto,
  SearchComicRequestDto,
} from './dto/third-party.dto'
import { CopyService } from './libs/copy.service'

@Injectable()
export class ComicThirdPartyService {
  constructor(private readonly copy: CopyService) {}

  /**
   * 搜索漫画
   * @param searchDto 搜索参数
   * @returns 搜索结果
   */
  async searchComic(searchDto: SearchComicRequestDto) {
    const { platform } = searchDto

    // 验证平台是否支持
    if (!this[platform] || !this[platform].searchWord) {
      throw new BadRequestException('暂不支持该平台')
    }

    try {
      return this[platform].searchWord(searchDto)
    } catch {
      throw new BadRequestException('搜索失败，请稍后重试')
    }
  }

  /**
   * 获取漫画详情
   * @param searchDto 搜索参数
   * @returns 漫画详情
   */
  async detail(searchDto: DetailComicRequestDto) {
    return this[searchDto.platform].detail(searchDto)
  }

  /**
   * 获取漫画章节
   * @param searchDto 搜索参数
   * @returns 漫画章节
   */
  async chapter(searchDto: DetailComicRequestDto) {
    return this[searchDto.platform].chapter(searchDto)
  }

  /**
   * 获取漫画章节内容
   * @param searchDto 搜索参数
   * @returns 漫画章节内容
   */
  async content(searchDto: DetailComicRequestDto) {
    return this[searchDto.platform].content(searchDto)
  }
}
