describe('geo helpers', () => {
  it('maps ip2region region text into a stable geo snapshot', async () => {
    const { parseIpRegionText } = await import('../geo.helpers')

    expect(parseIpRegionText('中国|0|广东省|深圳市|电信')).toEqual({
      geoCountry: '中国',
      geoProvince: '广东省',
      geoCity: '深圳市',
      geoIsp: '电信',
      geoSource: 'ip2region',
    })
  })

  it('treats internal-network placeholders as empty geo fields', async () => {
    const { parseIpRegionText } = await import('../geo.helpers')

    expect(parseIpRegionText('内网IP|内网IP|内网IP|内网IP|内网IP')).toEqual({
      geoCountry: undefined,
      geoProvince: undefined,
      geoCity: undefined,
      geoIsp: undefined,
      geoSource: 'ip2region',
    })
  })

  it('merges geo snapshot into the existing client request context', async () => {
    const { mergeGeoClientContext } = await import('../geo.helpers')

    expect(
      mergeGeoClientContext(
        {
          ip: '1.2.3.4',
          userAgent: 'Mozilla/5.0',
        },
        {
          geoCountry: '中国',
          geoProvince: '广东省',
          geoCity: '深圳市',
          geoIsp: '电信',
          geoSource: 'ip2region',
        },
      ),
    ).toEqual({
      ip: '1.2.3.4',
      userAgent: 'Mozilla/5.0',
      geoCountry: '中国',
      geoProvince: '广东省',
      geoCity: '深圳市',
      geoIsp: '电信',
      geoSource: 'ip2region',
    })
  })
})
