/// <reference types="jest" />

import { WorkChapterService } from '@libs/content/work/chapter/work-chapter.service'
import { WorkTypeEnum } from '@libs/platform/constant'
import { ComicChapterController } from './comic-chapter.controller'

function createController() {
  const workChapterService = {
    batchUpdateChapterPublishStatus: jest.fn(async () => true),
    deleteChapter: jest.fn(async () => true),
    deleteChapters: jest.fn(async () => true),
  }

  return {
    controller: new ComicChapterController(
      workChapterService as unknown as WorkChapterService,
    ),
    workChapterService,
  }
}

describe('ComicChapterController', () => {
  it('deletes one comic chapter with the single id contract', async () => {
    const { controller, workChapterService } = createController()

    await expect(controller.delete({ id: 1 })).resolves.toBe(true)

    expect(workChapterService.deleteChapter).toHaveBeenCalledWith(
      1,
      WorkTypeEnum.COMIC,
    )
    expect(workChapterService.deleteChapters).not.toHaveBeenCalled()
  })

  it('batch deletes comic chapters with the ids contract', async () => {
    const { controller, workChapterService } = createController()

    await expect(controller.batchDelete({ ids: [1, 2, 3] })).resolves.toBe(true)

    expect(workChapterService.deleteChapters).toHaveBeenCalledWith(
      [1, 2, 3],
      WorkTypeEnum.COMIC,
    )
  })

  it('batch publishes comic chapters with the ids contract', async () => {
    const { controller, workChapterService } = createController()

    await expect(
      controller.batchUpdateStatus({ ids: [1, 2], isPublished: true }),
    ).resolves.toBe(true)

    expect(
      workChapterService.batchUpdateChapterPublishStatus,
    ).toHaveBeenCalledWith(
      { ids: [1, 2], isPublished: true },
      WorkTypeEnum.COMIC,
    )
  })

  it('batch unpublishes comic chapters with the ids contract', async () => {
    const { controller, workChapterService } = createController()

    await expect(
      controller.batchUpdateStatus({ ids: [1, 2], isPublished: false }),
    ).resolves.toBe(true)

    expect(
      workChapterService.batchUpdateChapterPublishStatus,
    ).toHaveBeenCalledWith(
      { ids: [1, 2], isPublished: false },
      WorkTypeEnum.COMIC,
    )
  })
})
