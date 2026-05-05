import 'reflect-metadata'
import { RequestMethod } from '@nestjs/common'
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants'
import { MessageController } from './message.controller'

jest.mock('file-type', () => ({
  fileTypeFromBuffer: jest.fn(),
  fileTypeFromFile: jest.fn(),
}))

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid'),
}))

type MessageControllerTestApi = {
  uploadChatMedia: (req: unknown) => Promise<unknown>
}

function createController(chatUploadService: { uploadMedia: jest.Mock }) {
  const ControllerCtor = MessageController as unknown as new (
    ...args: unknown[]
  ) => MessageController

  return new ControllerCtor(
    {},
    {},
    {},
    {},
    chatUploadService,
  ) as unknown as MessageControllerTestApi
}

describe('MessageController chat media upload contract', () => {
  it('exposes a dedicated app chat media upload route', () => {
    expect(Reflect.getMetadata(PATH_METADATA, MessageController)).toBe(
      'app/message',
    )

    const handler = MessageController.prototype.uploadChatMedia

    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(
      'chat/media/upload',
    )
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(
      RequestMethod.POST,
    )
  })

  it('delegates chat media upload to the message domain service', async () => {
    const chatUploadService = {
      uploadMedia: jest.fn().mockResolvedValue({ scene: 'chat' }),
    }
    const controller = createController(chatUploadService)
    const req = { file: jest.fn() }

    const result = await controller.uploadChatMedia(req)

    expect(chatUploadService.uploadMedia).toHaveBeenCalledWith(req)
    expect(result).toEqual({ scene: 'chat' })
  })
})
