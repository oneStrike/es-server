import type {
  ChapterContentComicRequestDto,
  DetailComicRequestDto,
  SearchComicRequestDto,
} from '@libs/content/work/content/dto/content.dto'
import type { ThirdPartyProviderPolicy } from '../third-party-provider-policy.type'
import type { ComicThirdPartyProvider } from './comic-third-party-provider.type'
import type {
  CopyMangaChapterContentImage,
  CopyMangaChapterContentResults,
  CopyMangaChapterListItem,
  CopyMangaChapterResults,
  CopyMangaDetailResults,
  CopyMangaNamedItem,
  CopyMangaResponse,
  CopyMangaSearchItem,
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

  readonly policy: ThirdPartyProviderPolicy = {
    apiHostPolicy: {
      allowedExactHosts: ['api.2024manga.com'],
      allowedHostSuffixes: [
        '2024manga.com',
        'hotmangasg.com',
        'hotmangasd.com',
        'hotmangasf.com',
        'elfgjfghkk.club',
        'fgjfghkkcenter.club',
        'fgjfghkk.club',
      ],
      allowPort: false,
      redirect: 'error',
      addressGuard: 'system-config',
    },
    imageHostPolicy: {
      allowedExactHosts: [],
      allowedHostSuffixes: ['mangafunb.fun'],
      allowPort: false,
      redirect: 'error',
      addressGuard: 'system-config',
    },
    display: {
      displayName: '拷贝',
      sourceLabel: 'CopyManga',
      workRemarkPrefix: '三方导入',
    },
    chapterCover: {
      mode: 'unsupported',
      reason: '拷贝章节列表未提供章节封面',
    },
    throttle: {
      apiChannel: 'copy-manga-api',
      imageChannel: 'copy-manga-image',
    },
  }

  // 注入 CopyManga HTTP client，provider 只负责三方响应形状转换。
  constructor(private readonly httpClient: CopyMangaHttpClient) {}

  // 搜索 CopyManga 漫画并转换为本地统一分页结果。
  async searchComics(dto: SearchComicRequestDto) {
    const pageSize = dto.pageSize ?? 15
    const pageIndex = dto.pageIndex ?? 1
    const offset = (pageIndex - 1) * pageSize
    const results = this.unwrapResults<CopyMangaSearchResults>(
      await this.httpClient.getJson(
        '/api/v3/search/comic',
        {
          limit: pageSize,
          offset,
          q: dto.keyword,
        },
        this.policy,
      ),
      '搜索第三方漫画失败',
    )

    if (!Array.isArray(results.list)) {
      throw this.providerError('第三方搜索结果列表缺失')
    }

    return {
      total: results.total ?? 0,
      pageIndex: Math.floor((results.offset ?? offset) / pageSize) + 1,
      pageSize: results.limit ?? pageSize,
      list: results.list.map((item, index) => this.toSearchItem(item, index)),
    }
  }

  // 获取 CopyManga 漫画详情并转换为本地详情 DTO。
  async getDetail(dto: DetailComicRequestDto) {
    const results = this.unwrapResults<CopyMangaDetailResults>(
      await this.httpClient.getJson(
        `/api/v3/comic2/${dto.comicId}`,
        {},
        this.policy,
      ),
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
      uuid: comic.uuid ?? null,
      name: comic.name,
      alias: comic.alias ?? null,
      pathWord: comic.path_word,
      cover: comic.cover ?? null,
      brief: comic.brief ?? null,
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
      popular: comic.popular ?? results.popular ?? null,
      datetimeUpdated: comic.datetime_updated ?? null,
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
        this.policy,
      ),
      '获取第三方章节列表失败',
    )

    if (!Array.isArray(results.list)) {
      throw this.providerError('第三方章节列表缺失')
    }

    return results.list.map((chapter, index) =>
      this.toChapterItem(chapter, index, group),
    )
  }

  // 获取 CopyManga 章节图片列表并保持三方图片顺序。
  async getChapterContent(dto: ChapterContentComicRequestDto) {
    const results = this.unwrapResults<CopyMangaChapterContentResults>(
      await this.fetchChapterContent(dto),
      '获取第三方章节内容失败',
    )
    const chapter = results.chapter
    if (!chapter?.uuid || !chapter.name) {
      throw this.providerError('第三方章节内容为空')
    }

    const chapterUuid = chapter.uuid
    const images = (chapter?.contents ?? []).map((item, index) =>
      this.toChapterImageItem(chapterUuid, item, index),
    )

    if (images.length === 0) {
      throw this.providerError('第三方章节内容为空')
    }

    return {
      providerChapterId: chapter.uuid,
      title: chapter.name,
      images,
    }
  }

  // 校验 CopyManga 外层响应并取出有效 results。
  private unwrapResults<TResult>(payload: unknown, defaultMessage: string) {
    if (!payload || typeof payload !== 'object') {
      throw this.providerError('第三方平台返回了非 JSON 响应')
    }

    const response = payload as CopyMangaResponse<TResult>
    if (response.code !== 200) {
      throw this.providerError(response.message || defaultMessage)
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

  // 将搜索结果收敛为共享 DTO；关键展示/身份字段缺失时失败关闭。
  private toSearchItem(item: CopyMangaSearchItem, index: number) {
    if (!item.path_word || !item.name || !item.cover) {
      throw this.providerError(`第三方搜索结果字段缺失: index-${index + 1}`)
    }

    return {
      id: item.path_word,
      name: item.name,
      cover: item.cover,
      author: (item.author ?? [])
        .map((author) => author.name)
        .filter((name): name is string => Boolean(name)),
      source: this.policy.display.displayName,
      platform: this.platform.code,
    }
  }

  // 将章节列表结果收敛为共享 DTO；章节身份和标题缺失时失败关闭。
  private toChapterItem(
    chapter: CopyMangaChapterListItem,
    index: number,
    group: string,
  ) {
    if (!chapter.uuid || !chapter.name) {
      throw this.providerError(`第三方章节字段缺失: index-${index + 1}`)
    }
    if (
      typeof chapter.index !== 'number' ||
      !Number.isInteger(chapter.index) ||
      chapter.index < 0
    ) {
      throw this.providerError(`第三方章节排序缺失或非法: ${chapter.uuid}`)
    }

    return {
      providerChapterId: chapter.uuid,
      title: chapter.name,
      group: chapter.group_path_word ?? group,
      sortOrder: chapter.index + 1,
      imageCount: this.resolveChapterImageCount(chapter, index),
      chapterApiVersion: chapter.type ?? null,
      datetimeCreated: chapter.datetime_created ?? null,
    }
  }

  // 将章节图片结果收敛为共享 DTO；图片身份和 URL 缺失时失败关闭。
  private toChapterImageItem(
    chapterUuid: string,
    item: CopyMangaChapterContentImage,
    index: number,
  ) {
    if (!item.uuid || !item.url) {
      throw this.providerError(
        `第三方章节图片字段缺失: ${chapterUuid}:${index + 1}`,
      )
    }

    return {
      providerImageId: item.uuid,
      url: item.url,
      sortOrder: index + 1,
    }
  }

  // 解析章节图片数量；缺失或非法时直接拒绝导入该 provider 数据。
  private resolveChapterImageCount(
    chapter: CopyMangaChapterListItem,
    index: number,
  ) {
    const imageCount = chapter.size ?? chapter.count
    if (
      typeof imageCount === 'number' &&
      Number.isFinite(imageCount) &&
      Number.isInteger(imageCount) &&
      imageCount >= 0
    ) {
      return imageCount
    }

    throw this.providerError(
      `第三方章节图片数缺失或非法: ${chapter.uuid ?? `index-${index + 1}`}`,
    )
  }

  // 按章节内容接口版本生成唯一 API 路径；缺失或未知版本直接拒绝。
  private async fetchChapterContent(dto: ChapterContentComicRequestDto) {
    return this.httpClient.getJson(
      this.buildChapterContentPath(dto),
      {},
      this.policy,
    )
  }

  // 组装单个章节内容 API 路径。
  private buildChapterContentPath(dto: ChapterContentComicRequestDto) {
    const suffix = this.resolveChapterApiSuffix(dto.chapterApiVersion)
    return `/api/v3/comic/${dto.comicId}/chapter${suffix}/${dto.chapterId}`
  }

  // 将 provider 章节内容接口版本映射为路由后缀。
  private resolveChapterApiSuffix(version?: number) {
    if (version === 1) {
      return ''
    }
    if (version === 2 || version === 3) {
      return String(version)
    }
    throw this.providerError(
      `第三方章节接口版本缺失或不支持: ${version ?? 'null'}`,
    )
  }

  // 将 CopyManga 命名对象列表收敛为可展示名称数组。
  private toNames(items?: CopyMangaNamedItem[]) {
    return (items ?? [])
      .map((item) => item.name ?? item.display ?? item.value)
      .filter((name): name is string => Boolean(name))
  }

  // 解析 CopyManga 字符串或命名对象展示字段。
  private displayValue(value?: CopyMangaNamedItem | string) {
    if (!value) {
      return null
    }
    return typeof value === 'string'
      ? value
      : (value.display ?? value.name ?? value.value ?? null)
  }
}
