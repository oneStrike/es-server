import { BusinessException } from '@libs/platform/exceptions'
import chapterContentEmpty from '../__fixtures__/copy-manga/chapter-content-empty.json'
import chapterContentSuccess from '../__fixtures__/copy-manga/chapter-content-success.json'
import chaptersSuccess from '../__fixtures__/copy-manga/chapters-success.json'
import detailResultsNull from '../__fixtures__/copy-manga/detail-results-null.json'
import detailSuccess from '../__fixtures__/copy-manga/detail-success.json'
import searchSuccess from '../__fixtures__/copy-manga/search-success.json'
import { CopyMangaProvider } from './copy-manga.provider'

describe('CopyMangaProvider', () => {
  function createProvider(responseByPath: Record<string, unknown>) {
    const httpClient = {
      getJson: jest.fn(async (path: string) => responseByPath[path]),
    }

    return {
      httpClient,
      provider: new CopyMangaProvider(httpClient as never),
    }
  }

  it('normalizes search results into stable third-party rows', async () => {
    const { provider } = createProvider({
      '/api/v3/search/comic': searchSuccess,
    })

    const result = await provider.searchComics({
      keyword: '我独自',
      pageIndex: 1,
      pageSize: 10,
      platform: 'copy',
    })

    expect(result.total).toBe(117572)
    expect(result.pageIndex).toBe(1)
    expect(result.list[0]).toEqual({
      id: 'woduzishenji',
      name: '我獨自升級',
      cover:
        'https://sw.mangafunb.fun/w/woduzishenji/cover/1651527590.jpg.328x422.jpg',
      author: ['DUBU', 'Chugong'],
      source: '拷贝',
      platform: 'copy',
    })
  })

  it('normalizes detail and groups without exposing the raw CopyManga shape', async () => {
    const { provider } = createProvider({
      '/api/v3/comic2/woduzishenji': detailSuccess,
    })

    const detail = await provider.getDetail({
      comicId: 'woduzishenji',
      platform: 'copy',
    })

    expect(detail.id).toBe('woduzishenji')
    expect(detail.uuid).toBe('3b65f136-a419-11eb-a88c-024352452ce0')
    expect(detail.name).toBe('我獨自升級')
    expect(detail.authors).toEqual(['DUBU', 'Chugong'])
    expect(detail.groups).toEqual([
      {
        pathWord: 'default',
        name: '默认',
        count: 3,
      },
    ])
    expect(detail.sourceFlags.isVip).toBe(false)
  })

  it('normalizes chapter rows with stable ids and sort order', async () => {
    const { provider } = createProvider({
      '/api/v3/comic/woduzishenji/group/default/chapters': chaptersSuccess,
    })

    const chapters = await provider.getChapters({
      comicId: 'woduzishenji',
      platform: 'copy',
      group: 'default',
    })

    expect(chapters).toEqual([
      expect.objectContaining({
        providerChapterId: 'chapter-001',
        title: '第1话',
        group: 'default',
        sortOrder: 1,
        imageCount: 12,
        chapterApiVersion: 1,
      }),
      expect.objectContaining({
        providerChapterId: 'chapter-002',
        title: '第2话',
        group: 'default',
        sortOrder: 2,
        imageCount: 10,
        chapterApiVersion: 1,
      }),
    ])
  })

  it('uses the versioned chapter content endpoint from the chapter row', async () => {
    const { httpClient, provider } = createProvider({
      '/api/v3/comic/woduzishenji/chapter/chapter-001': chapterContentSuccess,
    })

    const content = await provider.getChapterContent({
      chapterId: 'chapter-001',
      chapterApiVersion: 1,
      comicId: 'woduzishenji',
      platform: 'copy',
    })

    expect(httpClient.getJson).toHaveBeenCalledWith(
      '/api/v3/comic/woduzishenji/chapter/chapter-001',
    )
    expect(content.providerChapterId).toBe('chapter-001')
    expect(content.images).toEqual([
      {
        providerImageId: 'chapter-001:1',
        url: 'https://sw.mangafunb.fun/w/woduzishenji/chapter-001/001.jpg',
        sortOrder: 1,
      },
      {
        providerImageId: 'chapter-001:2',
        url: 'https://sw.mangafunb.fun/w/woduzishenji/chapter-001/002.jpg',
        sortOrder: 2,
      },
    ])
  })

  it('keeps provider image uuids when CopyManga returns them', async () => {
    const { provider } = createProvider({
      '/api/v3/comic/woduzishenji/chapter/chapter-001': {
        ...chapterContentSuccess,
        results: {
          ...chapterContentSuccess.results,
          chapter: {
            ...chapterContentSuccess.results.chapter,
            contents: [
              {
                uuid: 'image-001',
                url: 'https://sw.mangafunb.fun/w/woduzishenji/chapter-001/001.jpg',
              },
            ],
          },
        },
      },
    })

    const content = await provider.getChapterContent({
      chapterId: 'chapter-001',
      chapterApiVersion: 1,
      comicId: 'woduzishenji',
      platform: 'copy',
    })

    expect(content.images).toEqual([
      {
        providerImageId: 'image-001',
        url: 'https://sw.mangafunb.fun/w/woduzishenji/chapter-001/001.jpg',
        sortOrder: 1,
      },
    ])
  })

  it('keeps chapter2 for chapter content version 2', async () => {
    const { httpClient, provider } = createProvider({
      '/api/v3/comic/woduzishenji/chapter2/chapter-001':
        chapterContentSuccess,
    })

    await provider.getChapterContent({
      chapterId: 'chapter-001',
      chapterApiVersion: 2,
      comicId: 'woduzishenji',
      platform: 'copy',
    })

    expect(httpClient.getJson).toHaveBeenCalledWith(
      '/api/v3/comic/woduzishenji/chapter2/chapter-001',
    )
  })

  it('throws when chapter content items do not have usable urls', async () => {
    const { provider } = createProvider({
      '/api/v3/comic/woduzishenji/chapter/chapter-001': {
        ...chapterContentSuccess,
        results: {
          ...chapterContentSuccess.results,
          chapter: {
            ...chapterContentSuccess.results.chapter,
            contents: [{ uuid: 'image-001' }],
          },
        },
      },
    })

    await expect(
      provider.getChapterContent({
        chapterId: 'chapter-001',
        chapterApiVersion: 1,
        comicId: 'woduzishenji',
        platform: 'copy',
      }),
    ).rejects.toThrow(BusinessException)
  })

  it('throws classified business errors for empty provider payloads', async () => {
    const { provider } = createProvider({
      '/api/v3/comic2/missing': detailResultsNull,
    })

    await expect(
      provider.getDetail({ comicId: 'missing', platform: 'copy' }),
    ).rejects.toThrow(BusinessException)
  })

  it('throws when chapter content has no images', async () => {
    const { provider } = createProvider({
      '/api/v3/comic/woduzishenji/chapter2/chapter-empty':
        chapterContentEmpty,
    })

    await expect(
      provider.getChapterContent({
        chapterId: 'chapter-empty',
        chapterApiVersion: 2,
        comicId: 'woduzishenji',
        platform: 'copy',
      }),
    ).rejects.toThrow(BusinessException)
  })
})
