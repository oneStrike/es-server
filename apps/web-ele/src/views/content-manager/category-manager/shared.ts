import type { BaseCategoryDto } from '#/apis/types/category';
import type { EsFormSchema } from '#/types';

import { formSchemaTransform } from '#/utils';

export const contentType = [
  {
    label: '漫画',
    value: 1,
  },
  {
    label: '小说',
    value: 2,
  },
  {
    label: '插画',
    value: 4,
  },
  {
    label: '图集',
    value: 8,
  },
];

/**
 * 分类管理模块的表单 Schema
 */
export const formSchema: EsFormSchema = [
  {
    component: 'Input',
    componentProps: {
      placeholder: '请输入分类名称',
    },
    fieldName: 'name',
    label: '分类名称',
    rules: 'required',
  },
  {
    component: 'Upload',
    componentProps: {
      placeholder: '请上传分类图标',
    },
    fieldName: 'icon',
    label: '图标',
  },
  {
    component: 'Input',
    componentProps: {
      type: 'number',
      placeholder: '请输入排序值（数字越小越靠前）',
    },
    fieldName: 'order',
    label: '排序',
  },
  {
    component: 'RadioGroup',
    componentProps: {
      options: [
        {
          label: '启用',
          value: true,
        },
        {
          label: '禁用',
          value: false,
        },
      ],
    },
    fieldName: 'isEnabled',
    label: '状态',
    defaultValue: true,
  },
  {
    label: '内容类型',
    fieldName: 'contentTypes',
    component: 'CheckboxGroup',
    rules: 'required',
    componentProps: {
      placeholder: '请选择内容类型',
      options: contentType,
      valueType: 'bitMask',
    },
  },
];

/**
 * 列定义：依据 formSchema 自动转换为表格列，并按需覆盖展示细节。
 * 与数据字典模块一致，统一使用 formSchemaTransform.toTableColumns。
 */
export const categoryColumns =
  formSchemaTransform.toTableColumns<BaseCategoryDto>(formSchema, {
    actions: {
      show: true,
    },
    icon: {
      cellRender: {
        name: 'CellImage',
      },
    },
    isEnabled: {
      show: true,
      title: '状态',
      sort: 99,
      slots: { default: 'isEnabled' },
    },
    contentTypes: {
      title: '应用类型',
      slots: { default: 'contentTypes' },
    },
  });

/**
 * 搜索表单 Schema：从 formSchema 选择常用筛选项，遵循数据字典的搜索构建方式。
 */
export const categorySearchSchema = formSchemaTransform.toSearchSchema(
  formSchema,
  {
    name: {
      show: true,
    },
    isEnabled: {
      show: true,
    },
    contentTypes: {
      show: true,
    },
  },
);
