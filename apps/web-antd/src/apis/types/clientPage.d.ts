/**
 *  类型定义 [CreateClientPageRequest]
 *  @来源 客户端页面配置模块
 *  @更新时间 2025-08-13 19:53:56
 */
export type CreateClientPageRequest = BasePageConfigFieldsDto;

export type CreateClientPageResponse = IdDto;

/**
 *  类型定义 [ClientPagePageRequest]
 *  @来源 客户端页面配置模块
 *  @更新时间 2025-08-13 19:53:56
 */
export type ClientPagePageRequest = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 页面权限级别 */
  accessLevel?: number;

  /* 结束时间 */
  endDate?: string;

  /* 排序字段，json格式 */
  orderBy?: string;

  /* 页面编码（唯一标识） */
  pageCode?: string;

  /* 当前页码 */
  pageIndex?: number;

  /* 页面名称 */
  pageName?: string;

  /* 单页大小，最大500，默认15 */
  pageSize?: number;

  /* 页面状态 */
  pageStatus?: number;

  /* 开始时间 */
  startDate?: string;
};

export type ClientPagePageResponse = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 列表数据 */
  list?: ClientPageConfigPageResponseDto[];

  /* 当前页码 */
  pageIndex?: number;

  /* 每页条数 */
  pageSize?: number;

  /* 总条数 */
  total?: number;
};

/**
 *  类型定义 [ClientPageDetailByIdRequest]
 *  @来源 客户端页面配置模块
 *  @更新时间 2025-08-13 19:53:56
 */
export type ClientPageDetailByIdRequest = {
  /** 任意合法数值 */
  [property: string]: any;

  id: number;
};

export type ClientPageDetailByIdResponse = ClientPageConfigResponseDto;

/**
 *  类型定义 [ClientPageDetailByCodeRequest]
 *  @来源 客户端页面配置模块
 *  @更新时间 2025-08-13 19:53:56
 */
export type ClientPageDetailByCodeRequest = {
  /** 任意合法数值 */
  [property: string]: any;

  pageCode: string;
};

export type ClientPageDetailByCodeResponse = ClientPageConfigResponseDto;

/**
 *  类型定义 [UpdateClientPageRequest]
 *  @来源 客户端页面配置模块
 *  @更新时间 2025-08-13 19:53:56
 */
export type UpdateClientPageRequest = UpdateClientPageConfigDto;

export type UpdateClientPageResponse = IdDto;

/**
 *  类型定义 [BatchDeleteClientPageRequest]
 *  @来源 客户端页面配置模块
 *  @更新时间 2025-08-13 19:53:56
 */
export type BatchDeleteClientPageRequest = IdsDto;

export type BatchDeleteClientPageResponse = CountDto;

/**
 *  类型定义 [BasePageConfigFieldsDto]
 *  @来源 components.schemas
 *  @更新时间 2025-08-13 19:53:56
 */
export type BasePageConfigFieldsDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 页面权限级别 */
  accessLevel: 0 | 1 | 2 | 3;
  /* 页面描述信息 */
  description?: string;
  /* 页面编码（唯一标识） */
  pageCode: string;
  /* 页面名称 */
  pageName: string;
  /* 页面路径（URL路径） */
  pagePath: string;
  /* 页面状态 */
  pageStatus: 0 | 1 | 2 | 3;

  /* 页面标题（用于SEO） */
  pageTitle?: string;
};

/**
 *  类型定义 [IdDto]
 *  @来源 components.schemas
 *  @更新时间 2025-08-13 19:53:56
 */
export type IdDto = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 主键id */
  id: number;
};

/**
 *  类型定义 [ClientPageConfigPageResponseDto]
 *  @来源 components.schemas
 *  @更新时间 2025-08-13 19:53:56
 */
export type ClientPageConfigPageResponseDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 页面权限级别 */
  accessLevel: 0 | 1 | 2 | 3;
  /* 创建时间 */
  createdAt: string;
  /* 主键id */
  id: number;
  /* 页面编码（唯一标识） */
  pageCode: string;
  /* 页面名称 */
  pageName: string;
  /* 页面路径（URL路径） */
  pagePath: string;
  /* 页面状态 */
  pageStatus: 0 | 1 | 2 | 3;
  /* 页面标题（用于SEO） */
  pageTitle?: string;
  /* 更新时间 */
  updatedAt: string;

  /* 访问次数统计 */
  viewCount: number;
};

/**
 *  类型定义 [ClientPageConfigResponseDto]
 *  @来源 components.schemas
 *  @更新时间 2025-08-13 19:53:56
 */
export type ClientPageConfigResponseDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 页面权限级别 */
  accessLevel: 0 | 1 | 2 | 3;
  /* 创建时间 */
  createdAt: string;
  /* 页面描述信息 */
  description?: string;
  /* 主键id */
  id: number;
  /* 页面编码（唯一标识） */
  pageCode: string;
  /* 页面名称 */
  pageName: string;
  /* 页面路径（URL路径） */
  pagePath: string;
  /* 页面状态 */
  pageStatus: 0 | 1 | 2 | 3;
  /* 页面标题（用于SEO） */
  pageTitle?: string;
  /* 更新时间 */
  updatedAt: string;

  /* 访问次数统计 */
  viewCount: number;
};

/**
 *  类型定义 [UpdateClientPageConfigDto]
 *  @来源 components.schemas
 *  @更新时间 2025-08-13 19:53:56
 */
export type UpdateClientPageConfigDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 页面权限级别 */
  accessLevel?: 0 | 1 | 2 | 3;
  /* 页面描述信息 */
  description?: string;
  /* 页面ID */
  id: number;
  /* 页面编码（唯一标识） */
  pageCode?: string;
  /* 页面名称 */
  pageName?: string;
  /* 页面路径（URL路径） */
  pagePath?: string;
  /* 页面状态 */
  pageStatus?: 0 | 1 | 2 | 3;

  /* 页面标题（用于SEO） */
  pageTitle?: string;
};

/**
 *  类型定义 [IdsDto]
 *  @来源 components.schemas
 *  @更新时间 2025-08-13 19:53:56
 */
export type IdsDto = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 主键id */
  ids: number[];
};

/**
 *  类型定义 [CountDto]
 *  @来源 components.schemas
 *  @更新时间 2025-08-13 19:53:56
 */
export type CountDto = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 操作成功的数据数量 */
  count: number;
};
