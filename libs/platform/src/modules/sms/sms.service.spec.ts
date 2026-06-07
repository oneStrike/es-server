import { SmsTemplateCodeEnum } from './sms.constant'
import { SmsService } from './sms.service'

const sendSmsVerifyCodeWithOptions = jest.fn()
const checkSmsVerifyCodeWithOptions = jest.fn()

jest.mock('@alicloud/dypnsapi20170525', () => {
  class SendSmsVerifyCodeRequest {
    constructor(readonly payload: Record<string, unknown>) {
      Object.assign(this, payload)
    }
  }
  class CheckSmsVerifyCodeRequest {
    constructor(readonly payload: Record<string, unknown>) {
      Object.assign(this, payload)
    }
  }
  return {
    __esModule: true,
    default: jest.fn(() => ({
      sendSmsVerifyCodeWithOptions,
      checkSmsVerifyCodeWithOptions,
    })),
    SendSmsVerifyCodeRequest,
    CheckSmsVerifyCodeRequest,
  }
})

describe('platform SmsService template purpose binding', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    sendSmsVerifyCodeWithOptions.mockResolvedValue({
      body: { code: 'OK' },
    })
    checkSmsVerifyCodeWithOptions.mockResolvedValue({
      body: { model: { verifyResult: 'PASS' } },
    })
  })

  function createService() {
    return new SmsService({
      getAliyunConfig: () => ({
        accessKeyId: 'access-key',
        accessKeySecret: 'access-secret',
        sms: {
          endpoint: 'dypnsapi.aliyuncs.com',
          signName: 'Akaiito',
          verifyCodeExpire: 300,
          verifyCodeLength: 6,
        },
      }),
    })
  }

  it('uses the template code as the Aliyun scheme when sending and checking', async () => {
    const service = createService()

    await service.sendVerifyCode({
      phone: '13800000000',
      templateCode: SmsTemplateCodeEnum.RESET_PASSWORD,
    })
    await service.checkVerifyCode({
      phone: '13800000000',
      code: '123456',
      templateCode: SmsTemplateCodeEnum.RESET_PASSWORD,
    })

    expect(sendSmsVerifyCodeWithOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        phoneNumber: '13800000000',
        schemeName: SmsTemplateCodeEnum.RESET_PASSWORD,
        templateCode: SmsTemplateCodeEnum.RESET_PASSWORD,
      }),
      expect.anything(),
    )
    expect(checkSmsVerifyCodeWithOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        phoneNumber: '13800000000',
        schemeName: SmsTemplateCodeEnum.RESET_PASSWORD,
        verifyCode: '123456',
      }),
      expect.anything(),
    )
  })
})
