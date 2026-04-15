import type { FastifyRequest } from 'fastify'
import { UploadController } from './upload.controller'

jest.mock('@libs/platform/modules/upload/upload.service', () => ({
  UploadService: class {},
}))

describe('app upload controller', () => {
  it('上传文件时复用平台上传服务', async () => {
    const req = {} as FastifyRequest
    const expectedResult = {
      filename: 'avatar.png',
      originalName: 'avatar.png',
      filePath: '/files/shared/2026-04-15/image/avatar.png',
      fileSize: 1024,
      mimeType: 'image/png',
      fileType: 'png',
      scene: 'shared',
      uploadTime: new Date('2026-04-15T00:00:00.000Z'),
    }
    const uploadService = {
      uploadFile: jest.fn().mockResolvedValue(expectedResult),
    }
    const controller = new UploadController(uploadService as never)

    const result = await controller.uploadFile(req)

    expect(uploadService.uploadFile).toHaveBeenCalledWith(req)
    expect(result).toBe(expectedResult)
  })
})
