import {
  ThirdPartyComicImportChapterActionEnum,
  ThirdPartyComicImportCoverModeEnum,
  ThirdPartyComicImportModeEnum,
  ThirdPartyComicImportStatusEnum,
} from '@libs/content/work/content/dto/content.dto'

jest.mock('@libs/content/work/content/comic-content.service', () => ({
  ComicContentService: class ComicContentService {},
}))
jest.mock('@libs/content/work/core/work.service', () => ({
  WorkService: class WorkService {},
}))
jest.mock('@libs/content/work/chapter/work-chapter.service', () => ({
  WorkChapterService: class WorkChapterService {},
}))
jest.mock('./remote-image-import.service', () => ({
  RemoteImageImportService: class RemoteImageImportService {},
}))

const { ThirdPartyComicImportService } = require('./third-party-comic-import.service')

describe('ThirdPartyComicImportService', () => {
  const detail = {
    id: 'woduzishenji',
    uuid: 'comic-uuid',
    name: '我獨自升級',
    alias: 'Solo Leveling',
    pathWord: 'woduzishenji',
    cover: 'https://sw.mangafunb.fun/w/woduzishenji/cover.jpg',
    brief: '作品简介',
    region: '韩国',
    status: '已完结',
    authors: ['DUBU'],
    taxonomies: ['冒险'],
    popular: 1,
    groups: [{ pathWord: 'default', name: '默认', count: 1 }],
    sourceFlags: {
      isLock: false,
      isLogin: false,
      isMobileBind: false,
      isVip: false,
    },
  }
  const chapters = [
    {
      providerChapterId: 'chapter-001',
      title: '第1话',
      group: 'default',
      sortOrder: 1,
      imageCount: 2,
    },
  ]
  const provider = {
    getDetail: jest.fn(async () => detail),
    getChapters: jest.fn(async () => chapters),
    getChapterContent: jest.fn(async () => ({
      providerChapterId: 'chapter-001',
      title: '第1话',
      images: [
        {
          providerImageId: 'image-001',
          url: 'https://sw.mangafunb.fun/w/woduzishenji/1.jpg',
          sortOrder: 1,
        },
      ],
    })),
  }

  function createService(overrides: Record<string, unknown> = {}) {
    const registry = {
      resolve: jest.fn(() => provider),
    }
    const workService = {
      createWorkReturningId: jest.fn(async () => 100),
      getWorkDetail: jest.fn(async () => ({ id: 200 })),
    }
    const workChapterService = {
      createChapterReturningId: jest.fn(async () => 300),
      updateChapter: jest.fn(async () => true),
    }
    const comicContentService = {
      replaceChapterContents: jest.fn(async () => true),
    }
    const remoteImageImportService = {
      importImage: jest.fn(async () => '/uploads/imported.jpg'),
      importImages: jest.fn(async () => ['/uploads/1.jpg']),
    }

    return {
      comicContentService,
      provider,
      registry,
      remoteImageImportService,
      service: new ThirdPartyComicImportService(
        registry as never,
        workService as never,
        workChapterService as never,
        comicContentService as never,
        remoteImageImportService as never,
      ),
      workChapterService,
      workService,
      ...overrides,
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('builds an import preview without local persistence side effects', async () => {
    const { service, workService, workChapterService, comicContentService } =
      createService()

    const preview = await service.previewImport({
      comicId: 'woduzishenji',
      platform: 'copy',
    })

    expect(preview.sourceSnapshot).toEqual(
      expect.objectContaining({
        providerComicId: 'woduzishenji',
        pathWord: 'woduzishenji',
        uuid: 'comic-uuid',
      }),
    )
    expect(preview.workDraft).toEqual(
      expect.objectContaining({
        name: '我獨自升級',
        alias: 'Solo Leveling',
        description: '作品简介',
        suggestedRegion: '韩国',
      }),
    )
    expect(preview.coverOptions.provider).toEqual({
      providerImageId: 'cover:woduzishenji',
      url: 'https://sw.mangafunb.fun/w/woduzishenji/cover.jpg',
    })
    expect(preview.chapters).toHaveLength(1)
    expect(workService.createWorkReturningId).not.toHaveBeenCalled()
    expect(workChapterService.createChapterReturningId).not.toHaveBeenCalled()
    expect(comicContentService.replaceChapterContents).not.toHaveBeenCalled()
  })

  it('does not create a work when createNew provider cover import fails', async () => {
    const { service, remoteImageImportService, workService } = createService()
    remoteImageImportService.importImage.mockRejectedValueOnce(
      new Error('download failed'),
    )

    const result = await service.confirmImport({
      chapters: [],
      comicId: 'woduzishenji',
      cover: {
        mode: ThirdPartyComicImportCoverModeEnum.PROVIDER,
        providerImageId: 'cover:woduzishenji',
      },
      mode: ThirdPartyComicImportModeEnum.CREATE_NEW,
      platform: 'copy',
      sourceSnapshot: { providerComicId: 'woduzishenji' },
      workDraft: {
        authorIds: [1],
        canComment: true,
        categoryIds: [1],
        chapterPrice: 0,
        description: '作品简介',
        isHot: false,
        isNew: false,
        isPublished: false,
        isRecommended: false,
        language: 'zh-CN',
        name: '我獨自升級',
        recommendWeight: 0,
        region: 'KR',
        serialStatus: 2,
        tagIds: [1],
        viewRule: 0,
      },
    })

    expect(result.status).toBe(ThirdPartyComicImportStatusEnum.FAILED)
    expect(result.work?.status).toBe('failed')
    expect(result.cover?.message).toBe('download failed')
    expect(result.work?.message).toBe('download failed')
    expect(workService.createWorkReturningId).not.toHaveBeenCalled()
  })

  it('does not overwrite existing chapter content when replacement image import fails', async () => {
    const { service, remoteImageImportService, comicContentService } =
      createService()
    remoteImageImportService.importImages.mockRejectedValueOnce(
      new Error('image failed'),
    )

    const result = await service.confirmImport({
      chapters: [
        {
          action: ThirdPartyComicImportChapterActionEnum.UPDATE,
          importImages: true,
          overwriteContent: true,
          providerChapterId: 'chapter-001',
          sortOrder: 1,
          targetChapterId: 300,
          title: '第1话',
        },
      ],
      comicId: 'woduzishenji',
      mode: ThirdPartyComicImportModeEnum.ATTACH_TO_EXISTING,
      platform: 'copy',
      sourceSnapshot: { providerComicId: 'woduzishenji' },
      targetWorkId: 200,
    })

    expect(result.status).toBe(ThirdPartyComicImportStatusEnum.PARTIAL_FAILED)
    expect(comicContentService.replaceChapterContents).not.toHaveBeenCalled()
  })
})
