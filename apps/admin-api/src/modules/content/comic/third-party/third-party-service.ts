import type {
  ChapterContentComicRequestDto,
  DetailComicRequestDto,
  SearchComicRequestDto,
  ThirdPartyComicImportPreviewRequestDto,
  ThirdPartyComicImportRequestDto,
} from '@libs/content/work/content/dto/content.dto'
import { Injectable } from '@nestjs/common'
import { ComicThirdPartyRegistry } from './providers/comic-third-party.registry'
import { ThirdPartyComicImportService } from './services/third-party-comic-import.service'

@Injectable()
export class ComicThirdPartyService {
  // 注入 provider registry 和导入服务，当前服务只做协议层转发。
  constructor(
    private readonly registry: ComicThirdPartyRegistry,
    private readonly importService: ThirdPartyComicImportService,
  ) {}

  // 获取当前可用的第三方漫画平台列表。
  listPlatforms() {
    return this.registry.listPlatforms()
  }

  // 转发第三方漫画搜索请求到对应 provider。
  async searchComic(searchDto: SearchComicRequestDto) {
    return this.registry.resolve(searchDto.platform).searchComics(searchDto)
  }

  // 转发第三方漫画详情请求到对应 provider。
  async detail(searchDto: DetailComicRequestDto) {
    return this.registry.resolve(searchDto.platform).getDetail(searchDto)
  }

  // 转发第三方漫画章节列表请求到对应 provider。
  async chapter(searchDto: DetailComicRequestDto) {
    return this.registry.resolve(searchDto.platform).getChapters(searchDto)
  }

  // 转发第三方漫画章节内容请求到对应 provider。
  async content(searchDto: ChapterContentComicRequestDto) {
    return this.registry
      .resolve(searchDto.platform)
      .getChapterContent(searchDto)
  }

  // 生成第三方漫画导入前预览，不产生本地写入副作用。
  async previewImport(dto: ThirdPartyComicImportPreviewRequestDto) {
    return this.importService.previewImport(dto)
  }

  // 确认第三方漫画导入，创建后台任务并立即返回。
  async confirmImport(dto: ThirdPartyComicImportRequestDto) {
    return this.importService.confirmImport(dto)
  }
}
