export type ThirdPartyPlatformResponse = PlatformResponseDto[];

/**
 *  类型定义 [ThirdPartySearchRequest]
 *  @来源 第三方漫画平台内容解析
 *  @更新时间 2025-11-28 23:47:20
 */
export type ThirdPartySearchRequest = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 搜索关键词 */
  keyword: string;

  /* 平台代码 */
  platform: string;
};

export type ThirdPartySearchResponse = SearchComicItemDto;

/**
 *  类型定义 [PlatformResponseDto]
 *  @来源 components.schemas
 *  @更新时间 2025-11-28 23:47:20
 */
export type PlatformResponseDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 平台名称code */
  code: string;

  /* 平台名称 */
  name: string;
};

/**
 *  类型定义 [SearchComicItemDto]
 *  @来源 components.schemas
 *  @更新时间 2025-11-28 23:47:20
 */
export type SearchComicItemDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 作者列表 */
  author: string[];
  /* 封面图片URL */
  cover: string;
  /* 漫画ID */
  id: string;
  /* 漫画名称 */
  name: string;

  /* 来源平台 */
  source: string;
};
