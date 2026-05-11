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

/** 第三方漫画 provider 内部协议，供 registry 和导入服务统一调用。 */
export interface ComicThirdPartyProvider {
  platform: PlatformResponseDto
  searchComics: (
    dto: SearchComicRequestDto,
  ) => Promise<ThirdPartyComicPageResult<SearchComicItemDto>>
  getDetail: (dto: DetailComicRequestDto) => Promise<ThirdPartyComicDetailDto>
  getChapters: (
    dto: DetailComicRequestDto,
  ) => Promise<ThirdPartyComicChapterDto[]>
  getChapterContent: (
    dto: ChapterContentComicRequestDto,
  ) => Promise<ThirdPartyComicChapterContentDto>
}
