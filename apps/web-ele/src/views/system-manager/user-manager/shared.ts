import type { UserDto } from '#/apis/types/user';
import type { EsFormSchema } from '#/types';

import { z } from '@vben/common-ui';

import { formSchemaTransform } from '#/utils';

/**
 * 用户角色配置
 */
export const userRole = [
  {
    label: '普通管理员',
    value: 0,
    type: 'info',
  },
  {
    label: '超级管理员',
    value: 1,
    type: 'warning',
  },
];

/**
 * 用户角色对象映射
 */
export const userRoleObj: Record<number, { label: string; type: string }> = {};
for (const item of userRole) {
  userRoleObj[item.value] = {
    label: item.label,
    type: item.type,
  };
}

/**
 * 用户状态配置
 */
export const userStatus = [
  {
    label: '禁用',
    value: 0,
    type: 'danger',
  },
  {
    label: '启用',
    value: 1,
    type: 'success',
  },
];

/**
 * 用户状态对象映射
 */
export const userStatusObj: Record<number, { label: string; type: string }> =
  {};
for (const item of userStatus) {
  userStatusObj[item.value] = {
    label: item.label,
    type: item.type,
  };
}

/**
 * 表单配置
 */
export const formSchema: EsFormSchema = [
  {
    component: 'Input',
    componentProps: {
      placeholder: '请输入用户名',
    },
    fieldName: 'username',
    label: '用户名',
    rules: 'required',
  },
  {
    component: 'Input',
    componentProps: {
      placeholder: '请输入手机号',
      maxlength: 11,
    },
    fieldName: 'mobile',
    label: '手机号',
    rules: 'required|phone',
  },
  {
    component: 'Input',
    componentProps: {
      placeholder: '请输入密码',
      type: 'password',
      showPassword: true,
    },
    fieldName: 'password',
    label: '密码',
    rules: 'required|min:6',
    dependencies: {
      triggerFields: ['id'], // 监听id字段变化
      if: (values) => !values.id, // 只在新增时显示
    },
  },
  {
    component: 'Input',
    componentProps: {
      placeholder: '请再次输入密码',
      type: 'password',
      showPassword: true,
    },
    fieldName: 'confirmPassword',
    label: '确认密码',
    dependencies: {
      triggerFields: ['id', 'password'], // 监听id和password字段变化
      if: (values) => !values.id, // 只在新增时显示
      rules: (values) => {
        return z
          .string()
          .min(1, { message: '请再次输入密码' })
          .refine((value) => value === values.password, {
            message: '两次密码输入不一致',
          });
      },
    },
  },
  {
    component: 'Upload',
    componentProps: {
      maxCount: 1,
      returnDataType: 'url',
      accept: 'image/*',
    },
    fieldName: 'avatar',
    label: '头像',
  },
  {
    label: '角色',
    fieldName: 'role',
    component: 'Select',
    rules: 'required',
    componentProps: {
      placeholder: '请选择角色',
      options: userRole,
      class: 'w-full',
    },
  },
  {
    label: '状态',
    fieldName: 'isEnabled',
    component: 'RadioGroup',
    rules: 'required',
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
  },
];

/**
 * 表格列配置
 */
export const userColumns = formSchemaTransform.toTableColumns<UserDto>(
  formSchema,
  {
    password: {
      hide: true, // 隐藏密码列
    },
    confirmPassword: {
      hide: true, // 隐藏确认密码列
    },
    avatar: {
      hide: true, // 头像在用户名列中显示
    },
    actions: {
      show: true,
      width: 150,
    },
    username: {
      slots: { default: 'username' },
      width: 200,
      sort: 1,
    },
    mobile: {
      width: 150,
      sort: 2,
    },
    role: {
      slots: { default: 'role' },
      width: 120,
      sort: 3,
    },
    isEnabled: {
      title: '状态',
      slots: { default: 'isEnabled' },
      width: 100,
      sort: 4,
    },
    isLocked: {
      title: '锁定状态',
      slots: { default: 'isLocked' },
      width: 120,
      sort: 5,
    },
    lastLoginAt: {
      title: '最后登录时间',
      slots: { default: 'lastLoginAt' },
      width: 180,
      sort: 6,
    },
    lastLoginIp: {
      title: '最后登录IP',
      width: 150,
      sort: 7,
    },
    loginFailCount: {
      title: '登录失败次数',
      width: 120,
      sort: 8,
    },
    createdAt: {
      title: '创建时间',
      width: 180,
      sort: 9,
    },
    updatedAt: {
      title: '更新时间',
      width: 180,
      sort: 10,
    },
  },
);

/**
 * 搜索表单配置
 */
export const userFilter = formSchemaTransform.toSearchSchema(formSchema, {
  password: {
    hide: true, // 搜索中隐藏密码字段
  },
  confirmPassword: {
    hide: true, // 搜索中隐藏确认密码字段
  },
  avatar: {
    hide: true, // 搜索中隐藏头像字段
  },
  username: {
    sort: 1,
  },
  mobile: {
    sort: 2,
  },
  role: {
    sort: 3,
  },
  isEnabled: {
    sort: 4,
    component: 'Select',
    componentProps: {
      placeholder: '请选择状态',
      options: userStatus,
      class: 'w-[280px]',
      allowClear: true,
    },
  },
});
