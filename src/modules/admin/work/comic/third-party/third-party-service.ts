import { BadRequestException, Injectable } from '@nestjs/common';

import { SearchComicRequestDto } from './dto/third-party.request';
import { CopyService } from './libs/copy.service';

@Injectable()
export class WorkComicThirdPartyService {
  constructor(private readonly copy: CopyService) {}

  /**
   * 搜索漫画
   * @param searchDto 搜索参数
   * @returns 搜索结果
   */
  async searchComic(searchDto: SearchComicRequestDto) {
    const { keyword, platform } = searchDto;

    // 验证平台是否支持
    if (!this[platform]?.searchWord) {
      throw new BadRequestException('暂不支持该平台');
    }

    try {
      const result = await this[platform].searchWord(keyword);
      return result;
    } catch (error) {
      console.log(
        '🚀 ~ WorkComicThirdPartyService ~ searchComic ~ error:',
        error
      );
      throw new BadRequestException('搜索失败，请稍后重试');
    }
  }
}
