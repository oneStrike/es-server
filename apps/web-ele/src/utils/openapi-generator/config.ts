/**
 * 命名配置
 */
export interface NamingConfig {
  /** 方法名生成策略：使用路径的几个上下文段 */
  methodNameSegments: number;
  /** 方法名后缀 */
  methodNameSuffix: string;
  /** 请求类型后缀 */
  requestTypeSuffix: string;
  /** 响应类型后缀 */
  responseTypeSuffix: string;
  /** 是否使用驼峰命名 */
  useCamelCase: boolean;
  /** 是否使用帕斯卡命名（类型） */
  usePascalCase: boolean;
}

// 移除了格式化配置接口

/**
 * OpenAPI 生成器配置
 */
export interface OpenAPIGeneratorConfig {
  /** API 基础 URL */
  baseUrl: string;
  /** OpenAPI 规范 URL */
  openApiUrl: string;
  /** 输出目录 */
  outputDir: string;
  /** 类型定义输出目录 */
  typesOutputDir: string;
  /** 类型文件目录名 */
  typesDirName: string;
  /** 请求处理器 */
  httpHandler: string;
  /** 请求处理器导入路径 */
  httpHandlerImport: string;
  /** 命名配置 */
  naming: NamingConfig;
  /** 日期时间格式化选项 */
  dateTimeOptions: Intl.DateTimeFormatOptions;
}

/**
 * 默认配置
 */
export const defaultConfig: OpenAPIGeneratorConfig = {
  baseUrl: 'http://127.0.0.1:4523/export/openapi/3?version=3.0',
  openApiUrl: 'http://127.0.0.1:4523/export/openapi/3?version=3.0',
  outputDir: './src/apis',
  typesOutputDir: './src/apis/types',
  typesDirName: 'types',
  httpHandler: 'requestClient',
  httpHandlerImport: '#/utils/request',
  naming: {
    methodNameSegments: 1,
    methodNameSuffix: 'Api',
    requestTypeSuffix: 'Request',
    responseTypeSuffix: 'Response',
    useCamelCase: true,
    usePascalCase: true,
  },
  dateTimeOptions: {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  },
};

/**
 * 类型映射配置
 */
export const TYPE_MAPPING = {
  // 基础类型
  array: 'any[]',
  boolean: 'boolean',
  integer: 'number',
  number: 'number',
  object: 'Record<string, any>',
  string: 'string',
  null: 'null',

  // 字符串格式类型
  'string:date': 'string',
  'string:date-time': 'string',
  'string:email': 'string',
  'string:uri': 'string',
  'string:uuid': 'string',
  'string:binary': 'File | Blob',
  'string:byte': 'string',
  'string:password': 'string',

  // 数字格式类型
  'number:float': 'number',
  'number:double': 'number',
  'integer:int32': 'number',
  'integer:int64': 'number',

  // 默认类型
  default: 'any',
} as const;

/**
 * 模板配置
 */
export const TEMPLATES = {
  /** API 方法注释模板 */
  apiMethodComment: (
    tag: string,
    summary: string,
    method: string,
    path: string,
    updateTime: string,
  ) => `/**
 *  @标签 ${tag}/${summary}
 *  @方式 ${method}
 *  @地址 ${path}
 *  @更新时间 ${updateTime}
 */`,

  /** 类型定义注释模板 */
  typeComment: (typeName: string, source: string, updateTime: string) => `/**
 *  类型定义 [${typeName}]
 *  @来源 ${source}
 *  @更新时间 ${updateTime}
 */`,

  /** 接口注释模板 */
  interfaceComment: (
    summary: string,
    tag: string,
    method: string,
    path: string,
    updateTime: string,
  ) => `/**
 *  接口 [${summary}]
 *  @标签 ${tag}/${summary}
 *  @方式 ${method}
 *  @地址 ${path}
 *  @更新时间 ${updateTime}
 */`,

  /** 索引签名模板 */
  indexSignature: '  /** 任意合法数值 */\n  [property: string]: any',
} as const;
