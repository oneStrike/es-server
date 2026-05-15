/// <reference types="jest" />

import { WorkChapterService } from '@libs/content/work/chapter/work-chapter.service'
import { ComicChapterController } from './comic-chapter.controller'

describe('ComicChapterController', () => {
  it('deletes one comic chapter with the single id contract', async () => {
    const workChapterService = {
      deleteChapter: jest.fn(() => Promise.resolve(true)),
      deleteChapters: jest.fn(() => Promise.resolve(true)),
    } as unknown as WorkChapterService
    const controller = new ComicChapterController(workChapterService)

    await expect(controller.delete({ id: 1 })).resolves.toBe(true)

    expect(workChapterService.deleteChapter).toHaveBeenCalledWith(1)
    expect(workChapterService.deleteChapters).not.toHaveBeenCalled()
  })

  it('batch deletes comic chapters with the ids contract', async () => {
    const workChapterService = {
      deleteChapter: jest.fn(() => Promise.resolve(true)),
      deleteChapters: jest.fn(() => Promise.resolve(true)),
    } as unknown as WorkChapterService
    const controller = new ComicChapterController(workChapterService)

    await expect(controller.batchDelete({ ids: [1, 2, 3] })).resolves.toBe(true)

    expect(workChapterService.deleteChapters).toHaveBeenCalledWith([1, 2, 3])
  })
})
