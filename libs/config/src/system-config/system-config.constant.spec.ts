import {
  CONFIG_SECURITY_META,
  DEFAULT_CONFIG,
} from './system-config.constant'

describe('system config constants', () => {
  it('keeps forum hashtag settings under operation config only', () => {
    expect(DEFAULT_CONFIG).toHaveProperty(
      'operationConfig.forumHashtagConfig.creationMode',
      2,
    )
    expect(DEFAULT_CONFIG).not.toHaveProperty('forumHashtagConfig')
  })

  it('uses operation config as the writable security whitelist node', () => {
    expect(CONFIG_SECURITY_META).toHaveProperty('operationConfig')
    expect(CONFIG_SECURITY_META.operationConfig.sensitivePaths).toEqual([])
    expect(CONFIG_SECURITY_META).not.toHaveProperty('forumHashtagConfig')
  })
})
