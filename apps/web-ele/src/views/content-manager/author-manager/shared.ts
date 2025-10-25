import type { AuthorPageResponseDto } from '#/apis/types/author';
import type { EsFormSchema } from '#/types';

import { formSchemaTransform } from '#/utils';

/**
 * 作者管理模块的表单 Schema
 */
export const formSchema: EsFormSchema = [
  {
    component: 'Upload',
    componentProps: {
      placeholder: '请上传作者头像',
    },
    fieldName: 'avatar',
    label: '头像',
    formItemClass: 'col-span-2',
  },
  {
    component: 'Input',
    componentProps: {
      placeholder: '请输入作者姓名',
    },
    fieldName: 'name',
    label: '作者姓名',
    rules: 'required',
  },
  {
    component: 'Select',
    componentProps: {
      placeholder: '请选择性别',
      options: [
        { label: '未知', value: 0 },
        { label: '男性', value: 1 },
        { label: '女性', value: 2 },
        { label: '其他', value: 3 },
      ],
    },
    fieldName: 'gender',
    label: '性别',
    rules: 'required',
  },
  {
    component: 'Input',
    componentProps: {
      placeholder: '请输入国籍',
    },
    fieldName: 'nationality',
    label: '国籍',
  },
  {
    component: 'CheckboxGroup',
    componentProps: {
      placeholder: '请选择作者身份',
      options: [
        { label: '作家', value: 1 },
        { label: '插画家', value: 2 },
        { label: '漫画家', value: 4 },
        { label: '模特', value: 8 },
      ],
    },
    fieldName: 'roles',
    label: '身份角色',
  },
  {
    component: 'Textarea',
    componentProps: {
      placeholder: '请输入作者描述',
      rows: 3,
    },
    fieldName: 'description',
    label: '作者描述',
    formItemClass: 'col-span-2',
  },
  {
    component: 'Textarea',
    componentProps: {
      placeholder: '请输入社交媒体链接（JSON格式）',
      rows: 3,
    },
    fieldName: 'socialLinks',
    label: '社交媒体',
    formItemClass: 'col-span-2',
  },
  {
    component: 'Textarea',
    componentProps: {
      placeholder: '请输入管理员备注',
      rows: 3,
    },
    fieldName: 'remark',
    label: '备注',
    formItemClass: 'col-span-2',
  },
];

/**
 * 角色位运算转换为名称数组
 */
function getRoleNames(roles?: number): string[] {
  if (!roles) return [];
  const roleMap = [
    { bit: 1, name: '作家' },
    { bit: 2, name: '插画家' },
    { bit: 4, name: '漫画家' },
    { bit: 8, name: '模特' },
  ];
  return roleMap.filter((role) => roles & role.bit).map((role) => role.name);
}

/**
 * 性别枚举转换
 */
function getGenderLabel(gender: 0 | 1 | 2 | 3): string {
  const genderMap = {
    0: '未知',
    1: '男性',
    2: '女性',
    3: '其他',
  };
  return genderMap[gender];
}

/**
 * 列定义：依据 formSchema 自动转换为表格列，并按需覆盖展示细节
 */
export const authorColumns =
  formSchemaTransform.toTableColumns<AuthorPageResponseDto>(formSchema, {
    avatar: {
      cellRender: {
        name: 'CellImage',
      },
    },
    gender: {
      formatter: ({ cellValue }) => getGenderLabel(cellValue),
    },
    roles: {
      title: '身份角色',
      formatter: ({ cellValue }) => getRoleNames(cellValue).join('、'),
      minWidth: 150,
    },
    isEnabled: {
      show: true,
      title: '状态',
      sort: 98,
      minWidth: 100,
      slots: { default: 'isEnabled' },
    },
    featured: {
      show: true,
      title: '推荐',
      sort: 99,
      minWidth: 100,
      slots: { default: 'featured' },
    },
    worksCount: {
      show: true,
      title: '作品数',
      field: 'worksCount',
      sort: 10,
      minWidth: 100,
      sortable: true,
    },
    followersCount: {
      show: true,
      title: '粉丝数',
      field: 'followersCount',
      sort: 11,
      minWidth: 100,
      sortable: true,
    },
    createdAt: {
      show: true,
    },
    actions: {
      show: true,
    },
  });

/**
 * 搜索表单 Schema：从 formSchema 选择常用筛选项
 */
export const authorSearchSchema = formSchemaTransform.toSearchSchema(
  formSchema,
  {
    name: {
      show: true,
    },
    gender: {
      show: true,
      componentProps: {
        clearable: true,
      },
    },
    nationality: {
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
    featured: {
      label: '是否推荐',
      component: 'Select',
      componentProps: {
        clearable: true,
        options: [
          {
            label: '是',
            value: true,
          },
          {
            label: '否',
            value: false,
          },
        ],
      },
    },
  },
);
