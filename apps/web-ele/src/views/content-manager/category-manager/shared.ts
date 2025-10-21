import type { BaseCategoryDto } from '#/apis/types/category';
import type { EsFormSchema } from '#/types';

import { formSchemaTransform } from '#/utils';

/**
 * 分类管理模块的表单 Schema
 */
export const formSchema: EsFormSchema = [
  {
    component: 'Upload',
    componentProps: {
      placeholder: '请上传分类图标',
    },
    fieldName: 'icon',
    label: '图标',
    formItemClass: 'col-span-2',
  },
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
    label: '内容类型',
    fieldName: 'contentType',
    component: 'CheckboxGroup',
    rules: 'required',
    componentProps: {
      placeholder: '请选择内容类型',
      options: [],
    },
  },
  {
    component: 'InputNumber',
    componentProps: {
      min: 0,
      max: 999_999_999,
      align: 'left',
      class: '!w-full',
      controlsPosition: 'right',
      placeholder: '请输入排序值（数字越小越靠前）',
    },
    fieldName: 'order',
    label: '排序',
  },
  {
    component: 'InputNumber',
    componentProps: {
      type: 'number',
      min: 0,
      max: 999_999_999,
      align: 'left',
      class: '!w-full',
      controlsPosition: 'right',
      placeholder: '请输入辅助热度',
    },
    fieldName: 'popularityWeight',
    label: '辅助热度',
  },
];

/**
 * 列定义：依据 formSchema 自动转换为表格列，并按需覆盖展示细节。
 * 与数据字典模块一致，统一使用 formSchemaTransform.toTableColumns。
 */
export const categoryColumns =
  formSchemaTransform.toTableColumns<BaseCategoryDto>(formSchema, {
    icon: {
      cellRender: {
        name: 'CellImage',
      },
    },
    isEnabled: {
      show: true,
      title: '状态',
      sort: 99,
      minWidth: 100,
      slots: { default: 'isEnabled' },
    },
    order: {
      sortable: true,
    },
    contentType: {
      title: '应用类型',
      cellRender: {
        name: 'CellTag',
      },
      minWidth: 200,
    },
    popularity: {
      title: '热度',
      field: 'popularity',
      sort: 9,
      minWidth: 100,
      sortable: true,
    },
    popularityWeight: {
      sort: 10,
      sortable: true,
    },
    createdAt: {
      show: true,
    },
    actions: {
      show: true,
    },
    seq: {
      dragSort: true,
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
      label: '状态',
      component: 'Select',
      componentProps: {
        clearable: true,
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
    },
    contentType: {
      show: true,
    },
  },
);
