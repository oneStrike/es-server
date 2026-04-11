import type {
  ChapterContentComicRequestDto,
  DetailComicRequestDto,
  SearchComicRequestDto,
} from '@libs/content/work/content/dto/content.dto'
import { BadRequestException, Injectable } from '@nestjs/common'
import { CopyService } from './libs/copy.service'

@Injectable()
export class ComicThirdPartyService {
  constructor(private readonly copy: CopyService) {}

  private resolvePlatform(platform: string) {
    const provider = this[platform as keyof this] as CopyService | undefined
    if (!provider || typeof provider.searchWord !== 'function') {
      throw new BadRequestException('暂不支持该平台')
    }
    return provider
  }

  /**
   * 搜索漫画
   * @param searchDto 搜索参数
   * @returns 搜索结果
   */
  async searchComic(searchDto: SearchComicRequestDto) {
    return this.resolvePlatform(searchDto.platform).searchWord(searchDto)
  }

  /**
   * 获取漫画详情
   * @param searchDto 搜索参数
   * @returns 漫画详情
   */
  async detail(searchDto: DetailComicRequestDto) {
    return this.resolvePlatform(searchDto.platform).detail(searchDto)
  }

  /**
   * 获取漫画章节
   * @param searchDto 搜索参数
   * @returns 漫画章节
   */
  async chapter(searchDto: DetailComicRequestDto) {
    return this.resolvePlatform(searchDto.platform).chapter(searchDto)
  }

  /**
   * 获取漫画章节内容
   * @param searchDto 搜索参数
   * @returns 漫画章节内容
   */
  async content(searchDto: ChapterContentComicRequestDto) {
    return this.resolvePlatform(searchDto.platform).content(searchDto)
  }
}
