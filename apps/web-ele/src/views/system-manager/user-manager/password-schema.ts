import type { EsFormSchema } from '#/types';

import { z } from '@vben/common-ui';

/**
 * 更新密码表单配置
 */
export const passwordFormSchema: EsFormSchema = [
  {
    component: 'Input',
    componentProps: {
      type: 'password',
      placeholder: '请输入当前密码',
      showPassword: true,
    },
    fieldName: 'oldPassword',
    label: '当前密码',
    rules: [
      {
        required: true,
        message: '请输入当前密码',
      },
    ],
  },
  {
    component: 'Input',
    componentProps: {
      type: 'password',
      placeholder: '请输入新密码',
      showPassword: true,
    },
    fieldName: 'newPassword',
    label: '新密码',
    rules: [
      {
        required: true,
        message: '请输入新密码',
      },
      {
        min: 6,
        message: '密码长度不能少于6位',
      },
    ],
  },
  {
    component: 'Input',
    componentProps: {
      type: 'password',
      placeholder: '请再次输入新密码',
      showPassword: true,
    },
    fieldName: 'confirmPassword',
    label: '确认密码',
    rules: z
      .string()
      .min(1, { message: '请再次输入新密码' })
      .refine(
        (value, ctx) => {
          const formData = ctx.path[0] as any;
          return value === formData?.newPassword;
        },
        { message: '两次输入的密码不一致' },
      ),
    dependencies: {
      triggerFields: ['newPassword'],
    },
  },
];
