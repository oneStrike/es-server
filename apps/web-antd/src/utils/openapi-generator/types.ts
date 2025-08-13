/**
 * OpenAPI 规范接口定义
 */
export interface OpenAPISpec {
  openapi: string;
  info: any;
  paths: Record<string, Record<string, any>>;
  components?: {
    schemas?: Record<string, any>;
  };
}

/**
 * 生成的文件信息
 */
export interface GeneratedFile {
  fileName: string;
  content: string;
  types: string;
}

/**
 * 路径操作信息
 */
export interface PathOperation {
  method: string;
  operation: any;
  path: string;
}

/**
 * 方法信息
 */
export interface MethodInfo {
  methodName: string;
  requestType: string;
  responseType: string;
}

/**
 * 模块代码生成结果
 */
export interface ModuleCodeResult {
  apiContent: string;
  typesContent: string;
}

/**
 * 分组的路径映射
 */
export type GroupedPaths = Record<string, PathOperation[]>;
