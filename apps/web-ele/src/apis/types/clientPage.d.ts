/**
 *  类型定义 [CreateClientPageRequest]
 *  @来源 客户端页面配置模块
 *  @更新时间 2025-10-24 11:07:47
 */
export type CreateClientPageRequest = BasePageConfigFieldsDto;

export type CreateClientPageResponse = IdDto;

/**
 *  类型定义 [ClientPagePageRequest]
 *  @来源 客户端页面配置模块
 *  @更新时间 2025-10-24 11:07:47
 */
export type ClientPagePageRequest = {
  /* 单页大小，最大500，默认15 */
  pageSize?: number;

  /* 当前页码 */
  pageIndex?: number;

  /* 排序字段，json格式 */
  orderBy?: string;

  /* 开始时间 */
  startDate?: string;

  /* 结束时间 */
  endDate?: string;

  /* 页面编码（唯一标识） */
  pageCode?: string;

  /* 页面名称 */
  pageName?: string;

  /* 页面权限级别 */
  accessLevel?: number;

  /* 页面状态 */
  pageStatus?: number;

  /** 任意合法数值 */
  [property: string]: any;
};

export type ClientPagePageResponse = {
  /* 当前页码 */
  pageIndex?: number;

  /* 每页条数 */
  pageSize?: number;

  /* 总条数 */
  total?: number;

  /* 列表数据 */
  list?: ClientPageConfigPageResponseDto[];

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [ClientPageDetailByIdRequest]
 *  @来源 客户端页面配置模块
 *  @更新时间 2025-10-24 11:07:47
 */
export type ClientPageDetailByIdRequest = {
  id: number;

  /** 任意合法数值 */
  [property: string]: any;
};

export type ClientPageDetailByIdResponse = ClientPageConfigResponseDto;

/**
 *  类型定义 [ClientPageDetailByCodeRequest]
 *  @来源 客户端页面配置模块
 *  @更新时间 2025-10-24 11:07:47
 */
export type ClientPageDetailByCodeRequest = {
  pageCode: string;

  /** 任意合法数值 */
  [property: string]: any;
};

export type ClientPageDetailByCodeResponse = ClientPageConfigResponseDto;

/**
 *  类型定义 [UpdateClientPageRequest]
 *  @来源 客户端页面配置模块
 *  @更新时间 2025-10-24 11:07:47
 */
export type UpdateClientPageRequest = UpdateClientPageConfigDto;

export type UpdateClientPageResponse = IdDto;

/**
 *  类型定义 [BatchDeleteClientPageRequest]
 *  @来源 客户端页面配置模块
 *  @更新时间 2025-10-24 11:07:47
 */
export type BatchDeleteClientPageRequest = IdsDto;

export type BatchDeleteClientPageResponse = CountDto;

/**
 *  类型定义 [BasePageConfigFieldsDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-24 11:07:47
 */
export type BasePageConfigFieldsDto = {
  /* 主键id */
  id: number;
  /* 页面编码（唯一标识） */
  pageCode: string;
  /* 页面路径（URL路径） */
  pagePath: string;
  /* 页面名称 */
  pageName: string;
  /* 页面标题（用于SEO） */
  pageTitle?: string;
  /* 页面权限级别 */
  accessLevel: 0 | 1 | 2 | 3;
  /* 页面状态 */
  pageStatus: 0 | 1 | 2 | 3;
  /* 页面描述信息 */
  description?: string;

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [IdDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-24 11:07:47
 */
export type IdDto = {
  /* 主键id */
  id: number;

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [ClientPageConfigPageResponseDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-24 11:07:47
 */
export type ClientPageConfigPageResponseDto = {
  /* 主键id */
  id: number;
  /* 页面编码（唯一标识） */
  pageCode: string;
  /* 页面路径（URL路径） */
  pagePath: string;
  /* 页面名称 */
  pageName: string;
  /* 页面标题（用于SEO） */
  pageTitle?: string;
  /* 页面权限级别 */
  accessLevel: 0 | 1 | 2 | 3;
  /* 页面状态 */
  pageStatus: 0 | 1 | 2 | 3;
  /* 访问次数统计 */
  viewCount: number;
  /* 创建时间 */
  createdAt: string;
  /* 更新时间 */
  updatedAt: string;

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [ClientPageConfigResponseDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-24 11:07:47
 */
export type ClientPageConfigResponseDto = {
  /* 主键id */
  id: number;
  /* 页面编码（唯一标识） */
  pageCode: string;
  /* 页面路径（URL路径） */
  pagePath: string;
  /* 页面名称 */
  pageName: string;
  /* 页面标题（用于SEO） */
  pageTitle?: string;
  /* 页面权限级别 */
  accessLevel: 0 | 1 | 2 | 3;
  /* 页面状态 */
  pageStatus: 0 | 1 | 2 | 3;
  /* 页面描述信息 */
  description?: string;
  /* 访问次数统计 */
  viewCount: number;
  /* 创建时间 */
  createdAt: string;
  /* 更新时间 */
  updatedAt: string;

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [UpdateClientPageConfigDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-24 11:07:47
 */
export type UpdateClientPageConfigDto = {
  /* 页面ID */
  id: number;
  /* 页面编码（唯一标识） */
  pageCode?: string;
  /* 页面路径（URL路径） */
  pagePath?: string;
  /* 页面名称 */
  pageName?: string;
  /* 页面标题（用于SEO） */
  pageTitle?: string;
  /* 页面权限级别 */
  accessLevel?: 0 | 1 | 2 | 3;
  /* 页面状态 */
  pageStatus?: 0 | 1 | 2 | 3;
  /* 页面描述信息 */
  description?: string;

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [IdsDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-24 11:07:47
 */
export type IdsDto = {
  /* 主键id集合 */
  ids: number[];

  /** 任意合法数值 */
  [property: string]: any;
};

/**
 *  类型定义 [CountDto]
 *  @来源 components.schemas
 *  @更新时间 2025-10-24 11:07:47
 */
export type CountDto = {
  /* 操作成功的数据数量 */
  count: number;

  /** 任意合法数值 */
  [property: string]: any;
};
