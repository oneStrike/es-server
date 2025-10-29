import type { ClientPagePageResponseDto } from '#/apis/types/clientPage';
import type { EsFormSchema } from '#/types';

import { formSchemaTransform } from '#/utils';

// 页面权限级别配置
export const accessLevel = [
  {
    label: '公开访问',
    value: 0,
    color: '#52c41a', // 绿色
  },
  {
    label: '登录访问',
    value: 1,
    color: '#1890ff', // 蓝色
  },
  {
    label: '会员访问',
    value: 2,
    color: '#fa8c16', // 橙色
  },
  {
    label: '管理员访问',
    value: 3,
    color: '#ff4d4f', // 红色
  },
];

export const accessLevelObj: Record<number, { color: string; label: string }> =
  {};
for (const item of accessLevel) {
  accessLevelObj[item.value] = {
    label: item.label,
    color: item.color,
  };
}

// 表单配置
export const formSchema: EsFormSchema = [
  {
    component: 'Input',
    componentProps: {
      placeholder: '请输入页面编码',
    },
    fieldName: 'code',
    label: '页面编码',
    rules: 'required',
  },
  {
    component: 'Input',
    componentProps: {
      placeholder: '请输入页面路径',
    },
    fieldName: 'path',
    label: '页面路径',
    rules: 'required',
  },
  {
    component: 'Input',
    componentProps: {
      placeholder: '请输入页面名称',
    },
    fieldName: 'name',
    label: '页面名称',
    rules: 'required',
  },
  {
    component: 'Input',
    componentProps: {
      placeholder: '请输入页面标题',
    },
    fieldName: 'title',
    label: '页面标题',
  },
  {
    label: '权限级别',
    fieldName: 'accessLevel',
    component: 'Select',
    rules: 'required',
    componentProps: {
      placeholder: '请选择权限级别',
      options: accessLevel,
      class: 'w-full',
    },
  },
  {
    label: '页面状态',
    fieldName: 'isEnabled',
    component: 'RadioGroup',
    rules: 'required',
    defaultValue: true,
    componentProps: {
      placeholder: '请选择页面状态',
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
      class: 'w-full',
    },
  },
  {
    label: '页面描述',
    fieldName: 'description',
    component: 'Input',
    formItemClass: 'col-span-2',
    componentProps: {
      type: 'textarea',
      placeholder: '请输入页面描述信息...',
      rows: 4,
    },
  },
];

// 表格列配置
export const pageColumns =
  formSchemaTransform.toTableColumns<ClientPagePageResponseDto>(formSchema, {
    description: {
      hide: true,
    },
    actions: {
      show: true,
      width: 200,
    },
    name: {
      sort: 1,
    },
    code: {
      sort: 2,
    },
    title: {
      showOverflow: 'tooltip',
      width: 150,
    },
    accessLevel: {
      slots: { default: 'accessLevel' },
      width: 140,
    },
    isEnabled: {
      slots: { default: 'isEnabled' },
      width: 100,
    },
  });

// 搜索表单配置
export const pageFilter = formSchemaTransform
  .toSearchSchema(formSchema, {
    code: {
      show: true,
    },
    name: {
      show: true,
    },
    isEnabled: {
      show: true,
    },
    accessLevel: {
      show: true,
    },
  })
  .reverse();
