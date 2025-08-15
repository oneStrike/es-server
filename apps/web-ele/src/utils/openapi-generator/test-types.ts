/**
 * 测试 OpenAPI 类型生成器的改进
 * 这个文件用于验证类型生成是否正确处理了复杂类型
 */

import {
  collectReferencedTypes,
  mapOpenAPIType,
  mapSchemaToType,
} from './utils';

// 测试用例 1: 基础类型映射
console.log('=== 基础类型测试 ===');
console.log('string:', mapOpenAPIType('string'));
console.log('number:', mapOpenAPIType('number'));
console.log('boolean:', mapOpenAPIType('boolean'));
console.log('integer:', mapOpenAPIType('integer'));

// 测试用例 2: 格式化类型映射
console.log('\n=== 格式化类型测试 ===');
console.log('string with date format:', mapOpenAPIType('string', 'date'));
console.log('string with email format:', mapOpenAPIType('string', 'email'));
console.log('string with binary format:', mapOpenAPIType('string', 'binary'));
console.log('integer with int64 format:', mapOpenAPIType('integer', 'int64'));

// 测试用例 3: 复杂 schema 类型映射
console.log('\n=== 复杂 Schema 测试 ===');

// 测试枚举类型
const enumSchema = {
  type: 'string',
  enum: ['active', 'inactive', 'pending'],
};
console.log('String enum:', mapSchemaToType(enumSchema));

// 测试数字枚举
const numberEnumSchema = {
  type: 'number',
  enum: [1, 2, 3],
};
console.log('Number enum:', mapSchemaToType(numberEnumSchema));

// 测试对象类型
const objectSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer' },
    name: { type: 'string' },
    email: { type: 'string', format: 'email' },
    isActive: { type: 'boolean' },
  },
  required: ['id', 'name'],
};
console.log('Object type:', mapSchemaToType(objectSchema));

// 测试数组类型
const arraySchema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      title: { type: 'string' },
    },
  },
};
console.log('Array type:', mapSchemaToType(arraySchema));

// 测试 $ref 引用
const refSchema = {
  $ref: '#/components/schemas/User',
};
console.log('Reference type:', mapSchemaToType(refSchema));

// 测试 allOf 组合类型
const allOfSchema = {
  allOf: [
    { $ref: '#/components/schemas/BaseEntity' },
    {
      type: 'object',
      properties: {
        name: { type: 'string' },
      },
    },
  ],
};
console.log('AllOf type:', mapSchemaToType(allOfSchema));

// 测试 oneOf 联合类型
const oneOfSchema = {
  oneOf: [
    { type: 'string' },
    { type: 'number' },
    { $ref: '#/components/schemas/CustomType' },
  ],
};
console.log('OneOf type:', mapSchemaToType(oneOfSchema));

// 测试引用类型收集
console.log('\n=== 引用类型收集测试 ===');
const referencedTypes = new Set<string>();

const complexSchema = {
  type: 'object',
  properties: {
    user: { $ref: '#/components/schemas/User' },
    posts: {
      type: 'array',
      items: { $ref: '#/components/schemas/Post' },
    },
    metadata: {
      allOf: [
        { $ref: '#/components/schemas/BaseMetadata' },
        {
          type: 'object',
          properties: {
            tags: {
              type: 'array',
              items: { $ref: '#/components/schemas/Tag' },
            },
          },
        },
      ],
    },
  },
};

collectReferencedTypes(complexSchema, referencedTypes);
console.log('Collected referenced types:', [...referencedTypes]);

export {};
