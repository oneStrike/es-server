import type { RequestContext } from '../request-parse.types'
import { ApiTypeEnum, HttpMethodEnum } from '@libs/platform/constant/base.constant'
import { buildRequestLogFields } from '../requestParse'

describe('request parse geo passthrough', () => {
  it('keeps pre-resolved geo fields when building request log fields', () => {
    const requestContext: RequestContext = {
      method: HttpMethodEnum.POST,
      path: '/api/admin/auth/login',
      apiType: ApiTypeEnum.ADMIN,
      geoCountry: '中国',
      geoProvince: '广东省',
      geoCity: '深圳市',
      geoIsp: '电信',
      geoSource: 'ip2region',
    }

    expect(buildRequestLogFields(requestContext)).toEqual(
      expect.objectContaining({
        geoCountry: '中国',
        geoProvince: '广东省',
        geoCity: '深圳市',
        geoIsp: '电信',
        geoSource: 'ip2region',
      }),
    )
  })
})
