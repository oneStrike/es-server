/// <reference types="jest" />

import { WorkChapterService } from '@libs/content/work/chapter/work-chapter.service'
import { ComicChapterController } from './comic-chapter.controller'

describe('ComicChapterController', () => {
  it('deletes comic chapters with the batch ids contract', async () => {
    const workChapterService = {
      deleteChapters: jest.fn(() => Promise.resolve(true)),
    } as unknown as WorkChapterService
    const controller = new ComicChapterController(workChapterService)

    await expect(controller.delete({ ids: [1, 2, 3] })).resolves.toBe(true)

    expect(workChapterService.deleteChapters).toHaveBeenCalledWith([1, 2, 3])
  })
})
