/**
 *  类型定义 [ClientPageCreateRequest]
 *  @来源 客户端页面配置模块
 *  @更新时间 2025-12-04 21:43:06
 */
export type ClientPageCreateRequest = BaseClientPageDto;

export type ClientPageCreateResponse = IdDto;

/**
 *  类型定义 [ClientPagePageRequest]
 *  @来源 客户端页面配置模块
 *  @更新时间 2025-12-04 21:43:06
 */
export type ClientPagePageRequest = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 页面权限级别 */
  accessLevel?: number;

  /* 页面编码（唯一标识） */
  code?: string;

  /* 结束时间 */
  endDate?: string;

  /* 页面启用状态 */
  isEnabled?: boolean;

  /* 页面名称 */
  name?: string;

  /* 排序字段，json格式 */
  orderBy?: string;

  /* 当前页码 */
  pageIndex?: number;

  /* 单页大小，最大500，默认15 */
  pageSize?: number;

  /* 开始时间 */
  startDate?: string;
};

export type ClientPagePageResponse = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 列表数据 */
  list?: ClientPageResponseDto[];

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
 *  @更新时间 2025-12-04 21:43:06
 */
export type ClientPageDetailByIdRequest = {
  /** 任意合法数值 */
  [property: string]: any;

  id: number;
};

export type ClientPageDetailByIdResponse = BaseClientPageDto;

/**
 *  类型定义 [ClientPageDetailByCodeRequest]
 *  @来源 客户端页面配置模块
 *  @更新时间 2025-12-04 21:43:06
 */
export type ClientPageDetailByCodeRequest = {
  /** 任意合法数值 */
  [property: string]: any;

  code: string;
};

export type ClientPageDetailByCodeResponse = BaseClientPageDto;

/**
 *  类型定义 [ClientPageUpdateRequest]
 *  @来源 客户端页面配置模块
 *  @更新时间 2025-12-04 21:43:06
 */
export type ClientPageUpdateRequest = UpdateClientPageDto;

export type ClientPageUpdateResponse = IdDto;

/**
 *  类型定义 [ClientPageBatchDeleteRequest]
 *  @来源 客户端页面配置模块
 *  @更新时间 2025-12-04 21:43:06
 */
export type ClientPageBatchDeleteRequest = IdsDto;

export type ClientPageBatchDeleteResponse = BatchOperationResponseDto;

/**
 *  类型定义 [BaseClientPageDto]
 *  @来源 components.schemas
 *  @更新时间 2025-12-04 21:43:06
 */
export type BaseClientPageDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 页面权限级别 */
  accessLevel: 0 | 1 | 2 | 3;
  /* 页面编码（唯一标识） */
  code: string;
  /* 创建时间 */
  createdAt: string;
  /* 页面描述信息 */
  description?: string;
  /* 主键id */
  id: number;
  /* 页面启用状态 */
  isEnabled: boolean;
  /* 页面名称 */
  name: string;
  /* 页面路径（URL路径） */
  path: string;
  /* 页面标题 */
  title: string;

  /* 更新时间 */
  updatedAt: string;
};

/**
 *  类型定义 [IdDto]
 *  @来源 components.schemas
 *  @更新时间 2025-12-04 21:43:06
 */
export type IdDto = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 主键id */
  id: number;
};

/**
 *  类型定义 [ClientPageResponseDto]
 *  @来源 components.schemas
 *  @更新时间 2025-12-04 21:43:06
 */
export type ClientPageResponseDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 页面权限级别 */
  accessLevel: 0 | 1 | 2 | 3;
  /* 页面编码（唯一标识） */
  code: string;
  /* 创建时间 */
  createdAt: string;
  /* 主键id */
  id: number;
  /* 页面启用状态 */
  isEnabled: boolean;
  /* 页面名称 */
  name: string;
  /* 页面路径（URL路径） */
  path: string;
  /* 页面标题 */
  title: string;

  /* 更新时间 */
  updatedAt: string;
};

/**
 *  类型定义 [UpdateClientPageDto]
 *  @来源 components.schemas
 *  @更新时间 2025-12-04 21:43:06
 */
export type UpdateClientPageDto = {
  /** 任意合法数值 */
  [property: string]: any;
  /* 页面权限级别 */
  accessLevel?: 0 | 1 | 2 | 3;
  /* 页面编码（唯一标识） */
  code?: string;
  /* 页面描述信息 */
  description?: string;
  /* 主键id */
  id?: number;
  /* 页面启用状态 */
  isEnabled?: boolean;
  /* 页面名称 */
  name?: string;
  /* 页面路径（URL路径） */
  path?: string;

  /* 页面标题 */
  title?: string;
};

/**
 *  类型定义 [IdsDto]
 *  @来源 components.schemas
 *  @更新时间 2025-12-04 21:43:06
 */
export type IdsDto = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 主键id集合 */
  ids: number[];
};

/**
 *  类型定义 [BatchOperationResponseDto]
 *  @来源 components.schemas
 *  @更新时间 2025-12-04 21:43:06
 */
export type BatchOperationResponseDto = {
  /** 任意合法数值 */
  [property: string]: any;

  /* 操作成功的数据量 */
  count: number;
};
