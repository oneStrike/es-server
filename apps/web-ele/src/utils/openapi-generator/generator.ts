import type { OpenAPIGeneratorConfig } from './config';
import type {
  GeneratedFile,
  GroupedPaths,
  MethodInfo,
  ModuleCodeResult,
  OpenAPISpec,
  PathOperation,
} from './types';

import { defaultConfig, TEMPLATES } from './config';
import {
  collectReferencedTypes,
  formatCurrentTime,
  mapOpenAPIType,
  mapSchemaToType,
  resolveRef,
  toCamelCase,
  toPascalCase,
} from './utils';

/**
 * OpenAPI 代码生成器核心类
 */
export class OpenAPIGenerator {
  private config: OpenAPIGeneratorConfig;
  private spec: null | OpenAPISpec = null;

  constructor(config: Partial<OpenAPIGeneratorConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * 获取 OpenAPI 文档
   */
  async fetchOpenAPISpec(url?: string): Promise<null | OpenAPISpec> {
    const apiUrl = url || this.config.openApiUrl;

    try {
      console.log(`正在请求 OpenAPI 文档: ${apiUrl}`);
      const response = await fetch(apiUrl);

      console.log(`响应状态: ${response.status} ${response.statusText}`);
      console.log(
        `响应头 Content-Type: ${response.headers.get('content-type')}`,
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('服务器响应错误内容:', errorText);
        throw new Error(
          `Failed to fetch OpenAPI spec: ${response.status} ${response.statusText}`,
        );
      }

      // 检查响应的 Content-Type
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.warn(`警告: 响应的 Content-Type 不是 JSON: ${contentType}`);
      }

      // 先获取响应文本，然后尝试解析
      const responseText = await response.text();
      console.log(`响应内容长度: ${responseText.length} 字符`);

      if (!responseText.trim()) {
        throw new Error('服务器返回了空响应');
      }

      // 显示响应内容的前100个字符用于调试
      console.log(
        `响应内容预览: ${responseText.slice(0, 100)}${responseText.length > 100 ? '...' : ''}`,
      );

      try {
        this.spec = JSON.parse(responseText);
        console.log('✅ OpenAPI 文档解析成功');
        return this.spec;
      } catch (parseError) {
        console.error('❌ JSON 解析失败:', parseError);
        console.error('响应内容:', responseText);
        throw new Error(
          `JSON 解析失败: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
        );
      }
    } catch (error) {
      console.error('❌ 获取 OpenAPI 文档失败:', error);
      throw error;
    }
  }

  /**
   * 生成 API 代码
   */
  generateAPICode(): GeneratedFile[] {
    if (!this.spec) {
      throw new Error('OpenAPI spec not loaded');
    }

    const files: GeneratedFile[] = [];
    const groupedPaths = this.groupPathsByModule();

    for (const [moduleName, paths] of Object.entries(groupedPaths)) {
      const { apiContent, typesContent } = this.generateModuleCode(
        moduleName,
        paths,
      );

      files.push({
        fileName: `${moduleName}.ts`,
        content: apiContent,
        types: typesContent,
      });
    }

    return files;
  }

  /**
   * 生成模块代码
   */
  generateModuleCode(
    moduleName: string,
    paths: PathOperation[],
    finalFileName?: string,
  ): ModuleCodeResult {
    const imports = new Set<string>();
    const apiMethods: string[] = [];
    const typeDefinitions: string[] = [];
    const referencedTypes = new Set<string>();

    for (const { path, method, operation } of paths) {
      const { requestType, responseType } = this.generateMethodInfo(path);

      // 检查是否需要参数
      const hasParams = this.hasRequestParams(method, operation);

      // 生成请求类型定义（仅当有参数时）
      if (hasParams) {
        const requestTypeDef = this.generateRequestType(requestType, operation);
        if (requestTypeDef) {
          typeDefinitions.push(requestTypeDef);
          imports.add(requestType);
          // 收集引用的类型
          collectReferencedTypes(
            operation.requestBody?.content?.['application/json']?.schema,
            referencedTypes,
          );
          if (operation.parameters) {
            operation.parameters.forEach((param: any) => {
              collectReferencedTypes(param.schema, referencedTypes);
            });
          }
        }
      }

      // 生成响应类型定义
      if (operation.responses && operation.responses['200']) {
        const responseTypeDef = this.generateResponseType(
          responseType,
          operation.responses['200'],
        );
        if (responseTypeDef) {
          typeDefinitions.push(responseTypeDef);
          imports.add(responseType);
          // 收集引用的类型
          collectReferencedTypes(
            operation.responses['200'].content?.['application/json']?.schema,
            referencedTypes,
          );
        }
      }

      // 生成API方法
      const apiMethod = this.generateAPIMethod(path, method, operation);
      apiMethods.push(apiMethod);
    }

    // 递归收集所有依赖的类型
    const allReferencedTypes = this.collectAllDependencies(referencedTypes);

    // 生成引用的类型定义
    for (const typeName of allReferencedTypes) {
      const schemaTypeDef = this.generateSchemaType(typeName);
      if (schemaTypeDef) {
        typeDefinitions.push(schemaTypeDef);
        imports.add(typeName);
      }
    }

    // 使用最终文件名（去掉.ts扩展名）来生成正确的类型导入路径
    const typeFileName = finalFileName
      ? finalFileName.replace('.ts', '')
      : moduleName;

    // 生成导入语句
    const importStatements =
      [...imports].length > 0
        ? `import type {\n  ${[...imports].join(',\n  ')}\n} from './${this.config.typesDirName}/${typeFileName}.d'\n\n`
        : '';

    const apiContent = `import { ${this.config.httpHandler} } from '${this.config.httpHandlerImport}'\n${importStatements}${apiMethods.join('\n\n')}\n`;

    const typesContent = typeDefinitions.join('\n\n');

    return { apiContent, typesContent };
  }

  /**
   * 按模块分组路径
   */
  groupPathsByModule(): GroupedPaths {
    const grouped: GroupedPaths = {};

    if (!this.spec) {
      return grouped;
    }

    for (const [path, methods] of Object.entries(this.spec.paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        if (typeof operation !== 'object') continue;

        const pathParts = path.split('/').filter(Boolean);
        if (pathParts.length === 0) continue;

        // 使用倒数第二个路径段作为模块名
        const secondLast =
          pathParts[pathParts.length - 2] ||
          pathParts[pathParts.length - 1] ||
          'default';
        const moduleName = toCamelCase(secondLast);

        if (!grouped[moduleName]) {
          grouped[moduleName] = [];
        }

        grouped[moduleName].push({
          path,
          method: method.toUpperCase(),
          operation,
        });
      }
    }

    return grouped;
  }

  /**
   * 递归收集所有依赖的类型
   */
  private collectAllDependencies(initialTypes: Set<string>): Set<string> {
    const allTypes = new Set<string>();
    const visited = new Set<string>();

    const collectDependencies = (typeName: string) => {
      if (visited.has(typeName)) return;
      visited.add(typeName);
      allTypes.add(typeName);

      // 获取该类型的 schema
      const schema = this.spec?.components?.schemas?.[typeName];
      if (!schema) return;

      // 收集该类型的所有依赖
      const dependencies = new Set<string>();
      collectReferencedTypes(schema, dependencies);

      // 递归收集依赖的依赖
      for (const dep of dependencies) {
        collectDependencies(dep);
      }
    };

    // 从初始类型开始收集
    for (const typeName of initialTypes) {
      collectDependencies(typeName);
    }

    return allTypes;
  }

  /**
   * 生成 API 方法
   */
  private generateAPIMethod(
    path: string,
    method: string,
    operation: any,
  ): string {
    const { methodName, requestType, responseType } =
      this.generateMethodInfo(path);
    const finalMethodName = `${methodName}${this.config.naming.methodNameSuffix}`;

    const hasParams = operation.parameters && operation.parameters.length > 0;
    const hasRequestBody = operation.requestBody;

    // 生成参数类型
    let paramType = 'void';
    if (hasParams || hasRequestBody) {
      paramType = requestType;
    }

    // 根据 HTTP 方法生成不同的调用方式
    let httpCall = '';
    const upperMethod = method.toUpperCase();

    if (upperMethod === 'GET' || upperMethod === 'DELETE') {
      // GET 和 DELETE 请求，参数通过 params 传递
      httpCall =
        paramType === 'void'
          ? `return ${this.config.httpHandler}.${method.toLowerCase()}<${responseType}>('${path}');`
          : `return ${this.config.httpHandler}.${method.toLowerCase()}<${responseType}>('${path}', { params });`;
    } else if (upperMethod === 'POST' || upperMethod === 'PUT') {
      // POST 和 PUT 请求，参数直接传递
      httpCall =
        paramType === 'void'
          ? `return ${this.config.httpHandler}.${method.toLowerCase()}<${responseType}>('${path}');`
          : `return ${this.config.httpHandler}.${method.toLowerCase()}<${responseType}>('${path}', params);`;
    } else {
      // 其他 HTTP 方法使用通用的 request 方法
      httpCall =
        paramType === 'void'
          ? `return ${this.config.httpHandler}.request<${responseType}>({ url: '${path}', method: '${upperMethod}' });`
          : `return ${this.config.httpHandler}.request<${responseType}>({ url: '${path}', method: '${upperMethod}', data: params });`;
    }

    // 生成方法签名
    const paramsOptional =
      paramType !== 'void' && this.isAllRequestFieldsOptional(operation);
    const paramSignature =
      paramType === 'void'
        ? ''
        : `params${paramsOptional ? '?' : ''}: ${paramType}`;

    return `
  /**
   * ${operation.summary || operation.description || `${upperMethod} ${path}`}
   */
  export async function ${finalMethodName}(${paramSignature}): Promise<${responseType}> {
    ${httpCall}
  }`;
  }

  /**
   * 生成方法信息
   */
  private generateMethodInfo(path: string): MethodInfo {
    const pathParts = path.split('/').filter(Boolean);
    const { naming } = this.config;

    // 根据配置的段数从后往前取路径段
    const segments = pathParts.slice(-naming.methodNameSegments);
    const methodNameBase = segments.join('-');

    // 根据配置生成方法名和类型名
    const methodName = naming.useCamelCase
      ? toCamelCase(methodNameBase)
      : methodNameBase;

    const typeNameBase = naming.usePascalCase
      ? toPascalCase(methodNameBase)
      : methodNameBase;

    const requestType = `${typeNameBase}${naming.requestTypeSuffix}`;
    const responseType = `${typeNameBase}${naming.responseTypeSuffix}`;

    return { methodName, requestType, responseType };
  }

  /**
   * 从 schema 生成属性
   */
  private generatePropertiesFromSchema(schema: any): string[] {
    const properties: string[] = [];

    // 处理 $ref 引用 - 这种情况应该在上层处理，这里不应该出现
    if (schema.$ref) {
      // 如果是引用类型，应该在调用方直接使用引用类型
      console.warn('引用类型应该在上层处理，不应该在这里出现');
      return [];
    }

    // 处理 allOf, oneOf, anyOf
    if (schema.allOf) {
      const types = schema.allOf.map((s: any) => {
        if (s.$ref) return resolveRef(s.$ref);
        return mapSchemaToType(s);
      });
      return [`  /* 组合类型 */\n  data: ${types.join(' & ')}`];
    }

    if (schema.oneOf || schema.anyOf) {
      const schemas = schema.oneOf || schema.anyOf;
      const types = schemas.map((s: any) => {
        if (s.$ref) return resolveRef(s.$ref);
        return mapSchemaToType(s);
      });
      return [`  /* 联合类型 */\n  data: ${types.join(' | ')}`];
    }

    if (schema.type === 'object' && schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        const prop = propSchema as any;
        const required = schema.required?.includes(propName) ? '' : '?';

        // 使用改进的类型映射
        const type = prop.$ref
          ? (resolveRef(prop.$ref) as string)
          : mapSchemaToType(prop);

        const description = prop.description ? `/* ${prop.description} */` : '';
        properties.push(`  ${description}\n  ${propName}${required}: ${type}`);
      }
    } else if (schema.type === 'array') {
      // 处理数组类型
      const itemType = schema.items?.$ref
        ? (resolveRef(schema.items.$ref) as string)
        : mapSchemaToType(schema.items);
      return [`  /* 数组数据 */\n  items: ${itemType}[]`];
    } else if (schema.enum) {
      // 处理枚举类型
      const enumType = mapSchemaToType(schema);
      return [`  /* 枚举值 */\n  value: ${enumType}`];
    }

    return properties;
  }

  /**
   * 生成请求类型
   */
  private generateRequestType(typeName: string, operation: any): null | string {
    const properties: string[] = [];

    // 处理查询参数
    if (operation.parameters) {
      for (const param of operation.parameters) {
        if (param.in === 'query' || param.in === 'path') {
          const required = param.required ? '' : '?';
          const type = mapOpenAPIType(
            param.schema?.type || 'string',
            param.schema?.format,
          );
          const description = param.description
            ? `/* ${param.description} */`
            : '';
          properties.push(
            `  ${description}\n  ${param.name}${required}: ${type}`,
          );
        }
      }
    }

    // 处理请求体
    if (operation.requestBody?.content?.['application/json']?.schema) {
      const schema = operation.requestBody.content['application/json'].schema;

      // 如果是引用类型，直接使用引用类型，不嵌套在 data 中
      if (schema.$ref) {
        const refType = resolveRef(schema.$ref);
        const updateTime = formatCurrentTime(this.config.dateTimeOptions);
        const comment = TEMPLATES.typeComment(
          typeName,
          operation.tags?.[0] || '',
          updateTime,
        );
        return `${comment}
export type ${typeName} = ${refType}`;
      }

      // 对于非引用类型，展开属性
      const bodyProps = this.generatePropertiesFromSchema(schema);
      properties.push(...bodyProps);
    }

    if (properties.length === 0) return null;

    const updateTime = formatCurrentTime(this.config.dateTimeOptions);
    const comment = TEMPLATES.typeComment(
      typeName,
      operation.tags?.[0] || '',
      updateTime,
    );

    // 使用 type 而不是 interface，添加索引签名
    return `${comment}
export type ${typeName} = {
${properties.join('\n\n')}

  /** 任意合法数值 */
  [property: string]: any
}`;
  }

  /**
   * 生成响应类型
   */
  private generateResponseType(typeName: string, response: any): null | string {
    if (!response.content?.['application/json']?.schema) return null;

    const schema = response.content['application/json'].schema;

    // 只解析data字段的数据
    let dataSchema = schema;
    if (schema.properties?.data) {
      dataSchema = schema.properties.data;
    }

    // 检查是否是基础类型数组
    if (dataSchema.type === 'array') {
      const itemType = mapSchemaToType(dataSchema.items);
      // 对于基础类型数组，直接返回类型别名
      return `export type ${typeName} = ${itemType}[]`;
    }

    // 检查是否是基础类型
    if (
      dataSchema.type &&
      ['boolean', 'integer', 'number', 'string'].includes(dataSchema.type)
    ) {
      const baseType = mapSchemaToType(dataSchema);
      return `export type ${typeName} = ${baseType}`;
    }

    // 检查是否是引用类型
    if (dataSchema.$ref) {
      const refType = resolveRef(dataSchema.$ref);
      return `export type ${typeName} = ${refType}`;
    }

    const properties = this.generatePropertiesFromSchema(dataSchema);

    if (properties.length === 0) return null;

    // 对象类型添加索引签名
    return `export type ${typeName} = {
${properties.join('\n\n')}

  /** 任意合法数值 */
  [property: string]: any
}`;
  }

  /**
   * 生成 schema 类型定义
   */
  private generateSchemaType(typeName: string): null | string {
    if (!this.spec?.components?.schemas?.[typeName]) return null;

    const schema = this.spec.components.schemas[typeName];
    const updateTime = formatCurrentTime(this.config.dateTimeOptions);

    // 处理 allOf 组合类型
    if (schema.allOf) {
      const types = schema.allOf.map((s: any) => {
        if (s.$ref) {
          return resolveRef(s.$ref);
        }
        if (s.properties) {
          const props = this.generatePropertiesFromSchema(s);
          return `{\n${props.join('\n')}\n  /** 任意合法数值 */\n  [property: string]: any\n}`;
        }
        return mapSchemaToType(s);
      });

      const comment = TEMPLATES.typeComment(
        typeName,
        'components.schemas',
        updateTime,
      );
      return `${comment}
export type ${typeName} = ${types.join(' & ')}`;
    }

    // 处理 oneOf/anyOf 联合类型
    if (schema.oneOf || schema.anyOf) {
      const schemas = schema.oneOf || schema.anyOf;
      const types = schemas.map((s: any) => {
        if (s.$ref) {
          return resolveRef(s.$ref);
        }
        if (s.properties) {
          const props = this.generatePropertiesFromSchema(s);
          return `{\n${props.join('\n')}\n  /** 任意合法数值 */\n  [property: string]: any\n}`;
        }
        return mapSchemaToType(s);
      });

      const comment = TEMPLATES.typeComment(
        typeName,
        'components.schemas',
        updateTime,
      );
      return `${comment}
export type ${typeName} = ${types.join(' | ')}`;
    }

    // 检查是否是基础类型数组
    if (schema.type === 'array') {
      const itemType = schema.items?.$ref
        ? (resolveRef(schema.items.$ref) as string)
        : mapSchemaToType(schema.items);

      const comment = TEMPLATES.typeComment(
        typeName,
        'components.schemas',
        updateTime,
      );
      return `${comment}
export type ${typeName} = ${itemType}[]`;
    }

    // 检查是否是枚举类型
    if (schema.enum) {
      const enumType = mapSchemaToType(schema);
      const comment = TEMPLATES.typeComment(
        typeName,
        'components.schemas',
        updateTime,
      );
      return `${comment}
export type ${typeName} = ${enumType}`;
    }

    // 检查是否是基础类型
    if (
      schema.type &&
      ['boolean', 'integer', 'number', 'string'].includes(schema.type)
    ) {
      const baseType = mapSchemaToType(schema);
      const comment = TEMPLATES.typeComment(
        typeName,
        'components.schemas',
        updateTime,
      );
      return `${comment}
export type ${typeName} = ${baseType}`;
    }

    // 处理对象类型
    const properties = this.generatePropertiesFromSchema(schema);

    if (properties.length === 0) {
      // 如果没有属性但有 additionalProperties，生成 Record 类型
      if (schema.additionalProperties) {
        const valueType =
          typeof schema.additionalProperties === 'object'
            ? mapSchemaToType(schema.additionalProperties)
            : 'any';

        const comment = TEMPLATES.typeComment(
          typeName,
          'components.schemas',
          updateTime,
        );
        return `${comment}
export type ${typeName} = Record<string, ${valueType}>`;
      }
      return null;
    }

    const comment = TEMPLATES.typeComment(
      typeName,
      'components.schemas',
      updateTime,
    );

    // 对象类型添加索引签名
    return `${comment}
export type ${typeName} = {
${properties.join('\n')}

  /** 任意合法数值 */
  [property: string]: any
}`;
  }

  /**
   * 检查接口是否需要参数
   */
  private hasRequestParams(method: string, operation: any): boolean {
    // 检查是否有请求体
    if (operation.requestBody?.content?.['application/json']?.schema) {
      return true;
    }

    // 检查是否有查询参数或路径参数
    if (operation.parameters && operation.parameters.length > 0) {
      return operation.parameters.some(
        (param: any) => param.in === 'query' || param.in === 'path',
      );
    }

    return false;
  }

  /**
   * 判断请求所有字段是否为可选
   * - 若存在任一必填的 query/path 参数，返回 false
   * - 若存在 requestBody：
   *   - 若为 $ref，解析到 components.schemas 判断是否有必填
   *   - 若为对象且无 required，视为全可选
   *   - 若为数组/基础类型/oneOf/anyOf/allOf，视为有必填单字段
   * - 若存在字段且未发现必填，返回 true
   */
  private isAllRequestFieldsOptional(operation: any): boolean {
    let hasAny = false;

    // 检查查询/路径参数
    if (operation.parameters && Array.isArray(operation.parameters)) {
      for (const param of operation.parameters) {
        if (param.in === 'query' || param.in === 'path') {
          hasAny = true;
          if (param.required) {
            return false;
          }
        }
      }
    }

    // 检查请求体
    const bodySchema =
      operation.requestBody?.content?.['application/json']?.schema;
    if (bodySchema) {
      hasAny = true;
      if (!this.isSchemaAllOptional(bodySchema)) {
        return false;
      }
    }

    // 如果有字段且全部可选，则返回 true；如果没有任何字段，这里通常不会被调用
    return hasAny;
  }

  /**
   * 判断一个 schema 在我们生成规则下是否“全可选”
   */
  private isSchemaAllOptional(schema: any): boolean {
    // $ref：解析引用继续判断
    if (schema.$ref) {
      const typeName = resolveRef(schema.$ref) as string;
      const refSchema = this.spec?.components?.schemas?.[typeName];
      if (!refSchema) return false;
      return this.isSchemaAllOptional(refSchema);
    }

    // 组合/联合类型：在 generatePropertiesFromSchema 中会作为单字段 data 输出，属必填
    if (schema.allOf || schema.oneOf || schema.anyOf) {
      return false;
    }

    // 对象：若无 required 列表或为空，则顶层属性均可选
    if (schema.type === 'object') {
      if (!schema.properties) {
        // 无属性即无必填，视为可选
        return true;
      }
      return !(Array.isArray(schema.required) && schema.required.length > 0);
    }

    // 数组/基础类型等：在生成中会作为必填单字段(items/value)输出
    return false;
  }
}
