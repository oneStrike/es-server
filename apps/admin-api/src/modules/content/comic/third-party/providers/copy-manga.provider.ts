import type {
  ChapterContentComicRequestDto,
  DetailComicRequestDto,
  SearchComicRequestDto,
} from '@libs/content/work/content/dto/content.dto'
import type { ComicThirdPartyProvider } from './comic-third-party-provider.type'
import type {
  CopyMangaChapterContentResults,
  CopyMangaApiFailureCause,
  CopyMangaChapterResults,
  CopyMangaDetailResults,
  CopyMangaNamedItem,
  CopyMangaResponse,
  CopyMangaSearchResults,
} from './copy-manga.type'
import { BusinessErrorCode } from '@libs/platform/constant'
import { BusinessException } from '@libs/platform/exceptions'
import { Injectable } from '@nestjs/common'
import { CopyMangaHttpClient } from './copy-manga-http.client'

@Injectable()
export class CopyMangaProvider implements ComicThirdPartyProvider {
  readonly platform = {
    code: 'copy',
    name: '拷贝',
  }

  // 注入 CopyManga HTTP client，provider 只负责三方响应形状转换。
  constructor(private readonly httpClient: CopyMangaHttpClient) {}

  // 搜索 CopyManga 漫画并转换为本地统一分页结果。
  async searchComics(dto: SearchComicRequestDto) {
    const pageSize = dto.pageSize ?? 15
    const pageIndex = dto.pageIndex ?? 1
    const offset = (pageIndex - 1) * pageSize
    const results = this.unwrapResults<CopyMangaSearchResults>(
      await this.httpClient.getJson('/api/v3/search/comic', {
        limit: pageSize,
        offset,
        q: dto.keyword,
      }),
      '搜索第三方漫画失败',
    )

    return {
      total: results.total ?? 0,
      pageIndex: Math.floor((results.offset ?? offset) / pageSize) + 1,
      pageSize: results.limit ?? pageSize,
      list: (results.list ?? []).map((item) => ({
        id: item.path_word ?? '',
        name: item.name ?? '',
        cover: item.cover ?? '',
        author: (item.author ?? [])
          .map((author) => author.name)
          .filter((name): name is string => Boolean(name)),
        source: this.platform.name,
        platform: this.platform.code,
      })),
    }
  }

  // 获取 CopyManga 漫画详情并转换为本地详情 DTO。
  async getDetail(dto: DetailComicRequestDto) {
    const results = this.unwrapResults<CopyMangaDetailResults>(
      await this.httpClient.getJson(`/api/v3/comic2/${dto.comicId}`),
      '获取第三方漫画详情失败',
    )
    const comic = results.comic

    if (!comic?.path_word || !comic.name) {
      throw this.providerError('第三方漫画详情为空')
    }

    const groups = Object.entries(results.groups ?? {}).map(([key, group]) => ({
      pathWord: group.path_word ?? key,
      name: group.name ?? key,
      count: group.count ?? 0,
    }))

    return {
      id: comic.path_word,
      uuid: comic.uuid,
      name: comic.name,
      alias: comic.alias,
      pathWord: comic.path_word,
      cover: comic.cover,
      brief: comic.brief,
      region: this.displayValue(comic.region),
      status: this.displayValue(comic.status),
      authors: this.toNames(comic.author),
      taxonomies: [
        ...this.toNames(comic.theme),
        ...this.toNames(comic.parodies),
        ...this.toNames(comic.clubs),
        ...this.toNames(
          [comic.reclass].filter(Boolean) as CopyMangaNamedItem[],
        ),
      ],
      popular: comic.popular ?? results.popular,
      datetimeUpdated: comic.datetime_updated,
      groups,
      sourceFlags: {
        isLock: Boolean(results.is_lock),
        isLogin: Boolean(results.is_login),
        isMobileBind: Boolean(results.is_mobile_bind),
        isVip: Boolean(results.is_vip),
      },
    }
  }

  // 获取 CopyManga 章节列表并转换为本地章节条目。
  async getChapters(dto: DetailComicRequestDto) {
    const group = dto.group || 'default'
    const results = this.unwrapResults<CopyMangaChapterResults>(
      await this.httpClient.getJson(
        `/api/v3/comic/${dto.comicId}/group/${group}/chapters`,
        {
          limit: 500,
          offset: 0,
        },
      ),
      '获取第三方章节列表失败',
    )

    return (results.list ?? []).map((chapter, index) => ({
      providerChapterId: chapter.uuid ?? '',
      title: chapter.name ?? `章节 ${index + 1}`,
      group: chapter.group_path_word ?? group,
      sortOrder: (chapter.index ?? index) + 1,
      imageCount: chapter.size ?? chapter.count,
      chapterApiVersion: chapter.type,
      datetimeCreated: chapter.datetime_created,
    }))
  }

  // 获取 CopyManga 章节图片列表并保持三方图片顺序。
  async getChapterContent(dto: ChapterContentComicRequestDto) {
    const results = this.unwrapResults<CopyMangaChapterContentResults>(
      await this.fetchChapterContent(dto),
      '获取第三方章节内容失败',
    )
    const chapter = results.chapter
    if (!chapter?.uuid) {
      throw this.providerError('第三方章节内容为空')
    }

    const chapterUuid = chapter.uuid
    const images = (chapter?.contents ?? [])
      .filter((item) => Boolean(item.url))
      .map((item, index) => ({
        providerImageId: this.resolveImageProviderId(chapterUuid, item, index),
        url: item.url!,
        sortOrder: index + 1,
      }))

    if (images.length === 0) {
      throw this.providerError('第三方章节内容为空')
    }

    return {
      providerChapterId: chapter.uuid,
      title: chapter.name ?? chapter.uuid,
      images,
    }
  }

  // 校验 CopyManga 外层响应并取出有效 results。
  private unwrapResults<TResult>(payload: unknown, fallbackMessage: string) {
    if (!payload || typeof payload !== 'object') {
      throw this.providerError('第三方平台返回了非 JSON 响应')
    }

    const response = payload as CopyMangaResponse<TResult>
    if (response.code !== 200) {
      throw this.providerError(response.message || fallbackMessage)
    }

    if (response.results === null || response.results === undefined) {
      throw this.providerError('第三方平台没有返回有效结果')
    }

    return response.results
  }

  // 统一 CopyManga provider 的可预期业务失败。
  private providerError(message: string) {
    return new BusinessException(
      BusinessErrorCode.OPERATION_NOT_ALLOWED,
      message,
    )
  }

  private async fetchChapterContent(dto: ChapterContentComicRequestDto) {
    let lastError: unknown
    const paths = this.buildChapterContentPaths(dto)
    for (const [index, path] of paths.entries()) {
      try {
        return await this.httpClient.getJson(path)
      } catch (error) {
        lastError = error
        if (!this.isRecoverableRouteCandidateError(error, path)) {
          throw error
        }
        if (index === paths.length - 1) {
          throw error
        }
      }
    }

    throw lastError
  }

  private buildChapterContentPaths(dto: ChapterContentComicRequestDto) {
    const suffix = this.resolveChapterApiSuffix(dto.chapterApiVersion)
    const suffixes = this.uniqueSuffixes(
      suffix === undefined ? ['', '2'] : [suffix, '', '2'],
    )
    return suffixes.map((item) => this.buildChapterContentPath(dto, item))
  }

  private buildChapterContentPath(
    dto: ChapterContentComicRequestDto,
    suffix: string,
  ) {
    return `/api/v3/comic/${dto.comicId}/chapter${suffix}/${dto.chapterId}`
  }

  private resolveImageProviderId(
    chapterUuid: string,
    item: { uuid?: string },
    index: number,
  ) {
    return item.uuid ?? `${chapterUuid}:${index + 1}`
  }

  private resolveChapterApiSuffix(version?: number) {
    if (version === 2 || version === 3) {
      return String(version)
    }
    return undefined
  }

  private uniqueSuffixes(suffixes: string[]) {
    return suffixes.filter(
      (suffix, index) => suffixes.indexOf(suffix) === index,
    )
  }

  // 判断当前章节内容候选路由失败是否允许继续尝试下一个候选。
  private isRecoverableRouteCandidateError(error: unknown, path: string) {
    if (!(error instanceof BusinessException)) {
      return false
    }

    const cause = this.readCopyMangaApiFailureCause(error)
    if (!cause) {
      return false
    }

    return cause.path === path && cause.routeCandidateRecoverable === true
  }

  // 收窄 CopyManga HTTP client 提供的安全失败原因。
  private readCopyMangaApiFailureCause(
    error: BusinessException,
  ): CopyMangaApiFailureCause | undefined {
    const cause = error.cause
    if (!cause || typeof cause !== 'object') {
      return undefined
    }
    const candidate = cause as Partial<CopyMangaApiFailureCause>
    if (
      typeof candidate.path !== 'string' ||
      typeof candidate.routeCandidateRecoverable !== 'boolean'
    ) {
      return undefined
    }
    return candidate as CopyMangaApiFailureCause
  }

  // 将 CopyManga 命名对象列表收敛为可展示名称数组。
  private toNames(items?: CopyMangaNamedItem[]) {
    return (items ?? [])
      .map((item) => item.name ?? item.display ?? item.value)
      .filter((name): name is string => Boolean(name))
  }

  // 兼容 CopyManga 字符串或命名对象两种展示字段。
  private displayValue(value?: CopyMangaNamedItem | string) {
    if (!value) {
      return undefined
    }
    return typeof value === 'string'
      ? value
      : (value.display ?? value.name ?? value.value)
  }
}
