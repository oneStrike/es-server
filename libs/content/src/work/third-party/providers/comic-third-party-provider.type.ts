import type {
  ChapterContentComicRequestDto,
  DetailComicRequestDto,
  PlatformResponseDto,
  SearchComicItemDto,
  SearchComicRequestDto,
  ThirdPartyComicChapterContentDto,
  ThirdPartyComicChapterDto,
  ThirdPartyComicDetailDto,
} from '@libs/content/work/content/dto/content.dto'

/** 第三方漫画分页结果，复用本地搜索列表 DTO 作为条目 contract。 */
export interface ThirdPartyComicPageResult<TItem> {
  pageIndex: number
  pageSize: number
  total: number
  list: TItem[]
}

/** 第三方漫画 provider 请求选项，用于长耗时请求前续租等执行期信号。 */
export interface ComicThirdPartyProviderRequestOptions {
  heartbeat?: () => Promise<void>
}

/** 第三方漫画 provider 内部协议，供 registry 和导入服务统一调用。 */
export interface ComicThirdPartyProvider {
  platform: PlatformResponseDto
  searchComics: (
    dto: SearchComicRequestDto,
    options?: ComicThirdPartyProviderRequestOptions,
  ) => Promise<ThirdPartyComicPageResult<SearchComicItemDto>>
  getDetail: (
    dto: DetailComicRequestDto,
    options?: ComicThirdPartyProviderRequestOptions,
  ) => Promise<ThirdPartyComicDetailDto>
  getChapters: (
    dto: DetailComicRequestDto,
    options?: ComicThirdPartyProviderRequestOptions,
  ) => Promise<ThirdPartyComicChapterDto[]>
  getChapterContent: (
    dto: ChapterContentComicRequestDto,
    options?: ComicThirdPartyProviderRequestOptions,
  ) => Promise<ThirdPartyComicChapterContentDto>
}
