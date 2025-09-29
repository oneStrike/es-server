import type { UserDto } from '#/apis/types/user';
import type { EsFormSchema } from '#/types';

import { z } from '#/adapter/form';
import { formatUTC, formSchemaTransform } from '#/utils';

// 用户角色配置
export const userRole = [
  {
    label: '普通管理员',
    value: 0,
    color: '#1890ff', // 蓝色
  },
  {
    label: '超级管理员',
    value: 1,
    color: '#ff4d4f', // 红色
  },
];

export const userRoleObj: Record<number, { color: string; label: string }> = {};
for (const item of userRole) {
  userRoleObj[item.value] = {
    label: item.label,
    color: item.color,
  };
}

// 用户状态配置
export const userStatus = [
  {
    label: '启用',
    value: true,
    color: '#52c41a', // 绿色
  },
  {
    label: '禁用',
    value: false,
    color: '#ff4d4f', // 红色
  },
];

export const userStatusObj: Record<string, { color: string; label: string }> =
  {};
for (const item of userStatus) {
  userStatusObj[String(item.value)] = {
    label: item.label,
    color: item.color,
  };
}

// 锁定状态配置
export const lockStatus = [
  {
    label: '正常',
    value: false,
    color: '#52c41a', // 绿色
  },
  {
    label: '锁定',
    value: true,
    color: '#ff4d4f', // 红色
  },
];

export const lockStatusObj: Record<string, { color: string; label: string }> =
  {};
for (const item of lockStatus) {
  lockStatusObj[String(item.value)] = {
    label: item.label,
    color: item.color,
  };
}

// 表单配置
export const formSchema: EsFormSchema = [
  {
    component: 'Input',
    componentProps: {
      placeholder: '请输入用户名',
      autocomplete: 'new-password',
    },
    fieldName: 'username',
    label: '用户名',
    rules: z.string().min(1, '用户名不能为空'),
  },
  {
    component: 'Input',
    componentProps: {
      placeholder: '请输入手机号',
    },
    fieldName: 'mobile',
    label: '手机号',
    rules: z
      .string()
      .min(1, '手机号不能为空')
      .regex(/^1[3-9]\d{9}$/, '请输入正确的手机号格式'),
  },
  {
    component: 'Input',
    componentProps: {
      placeholder: '请输入密码',
      type: 'password',
      showPassword: true,
      autocomplete: 'new-password',
    },
    fieldName: 'password',
    label: '密码',
    rules: z.string().min(6, '密码长度不能少于6位'),
  },
  {
    component: 'Input',
    componentProps: {
      placeholder: '请确认密码',
      type: 'password',
      showPassword: true,
    },
    fieldName: 'confirmPassword',
    label: '确认密码',
    rules: z.string().min(6, '密码长度不能少于6位'),
  },
  {
    label: '角色',
    fieldName: 'role',
    component: 'Select',
    rules: z.number().min(0, '请选择角色'),
    componentProps: {
      placeholder: '请选择角色',
      options: userRole,
      class: 'w-full',
    },
  },
  {
    label: '是否启用',
    fieldName: 'isEnabled',
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
    defaultValue: true,
  },
  {
    component: 'Upload',
    fieldName: 'avatar',
    label: '头像',
    componentProps: {
      maxCount: 1,
      returnDataType: 'url',
      accept: 'image/*',
    },
  },
];

// 编辑表单 - 明确排除密码相关字段
export const editFormSchema: EsFormSchema = formSchema.filter(
  (item) =>
    item.fieldName !== 'password' && item.fieldName !== 'confirmPassword',
);

// 表格列配置
export const userColumns = formSchemaTransform.toTableColumns<UserDto>(
  formSchema,
  {
    password: {
      hide: true,
    },
    confirmPassword: {
      hide: true,
    },
    avatar: {
      hide: true,
    },
    username: {
      showOverflow: 'tooltip',
    },
    mobile: {},
    role: {
      slots: { default: 'role' },
    },
    isEnabled: {
      title: '状态',
      slots: { default: 'isEnabled' },
    },
    createdAt: {
      title: '创建时间',
      formatter: ({ cellValue }: any) => formatUTC(cellValue),
      sortable: true,
      minWidth: 160,
      sort: 99,
    },
    actions: {
      show: true,
      width: 180,
    },
  },
);

// 搜索表单配置
export const userFilter = formSchemaTransform.toSearchSchema(formSchema, {
  username: {
    sort: 99,
  },
  mobile: {
    sort: 98,
  },
  role: {
    sort: 97,
  },
  isEnabled: {
    sort: 96,
  },
  dateRange: {
    sort: 95,
    component: 'DatePicker',
    fieldName: 'dateRange',
    label: '创建时间',
    componentProps: {
      type: 'datetimerange',
      startPlaceholder: '开始时间',
      endPlaceholder: '结束时间',
      format: 'YYYY-MM-DD HH:mm:ss',
      valueFormat: 'YYYY-MM-DD HH:mm:ss',
      clearable: true,
    },
  },
});
