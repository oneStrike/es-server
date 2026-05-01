import { ConfigReader } from './config-reader'
import { DEFAULT_CONFIG } from './system-config.constant'

describe('ConfigReader', () => {
  it('reads forum hashtag config from operation config', async () => {
    const cachedConfig = {
      ...DEFAULT_CONFIG,
      operationConfig: {
        forumHashtagConfig: {
          creationMode: 1,
        },
      },
    }
    const cacheManager = {
      get: jest.fn().mockResolvedValue(cachedConfig),
    }
    const reader = new ConfigReader(cacheManager as never)

    await reader.onModuleInit()

    expect(reader.getForumHashtagConfig()).toEqual({
      creationMode: 1,
    })
  })
})
