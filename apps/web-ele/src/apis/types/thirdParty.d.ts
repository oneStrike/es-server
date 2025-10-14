export type PlatformResponse = PlatformResponseDto[];

/**
 *  类型定义 [SearchRequest]
 *  @来源 第三方漫画平台内容解析
 *  @更新时间 2025-10-14 22:09:57
 */
export type SearchRequest = {
  /* 搜索关键词 */
  keyword: string;

  /* 平台代码 */
  platform: string;

  /** 任意合法数值 */
  [property: string]: any;
};

export type SearchResponse = SearchComicItemDto;

/**
 *  类型定义 [PlatformResponseDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-14 22:09:57
 */
export type PlatformResponseDto = {
  /* 平台名称 */
  name: string;
  /* 平台名称code */
  code: string;

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [SearchComicItemDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-14 22:09:57
 */
export type SearchComicItemDto = {
  /* 漫画ID */
  id: string;
  /* 漫画名称 */
  name: string;
  /* 封面图片URL */
  cover: string;
  /* 作者列表 */
  author: string[];
  /* 来源平台 */
  source: string;

  /** 任意合法数值 */
  [property: string]: any;
};
