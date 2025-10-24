<script setup lang="ts">
import type { VxeGridProps } from '#/adapter/vxe-table';
import type {
  RequestLogDto,
  RequestLogPageRequest,
} from '#/apis/types/requestLog';

import { Page } from '@vben/common-ui';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { requestLogPageApi } from '#/apis/requestLog';
import { createSearchFormOptions } from '#/utils';

import { loginLogColumns, searchFormSchema } from './shared';

// 表格配置
const gridOptions: VxeGridProps<RequestLogDto> = {
  columns: loginLogColumns,
  height: 'auto',
  proxyConfig: {
    ajax: {
      query: async ({ page }, formValues) => {
        // 处理时间范围参数
        let endDate, startDate;
        if (formValues.dateRange && formValues.dateRange.length === 2) {
          [startDate, endDate] = formValues.dateRange;
        }

        const params: RequestLogPageRequest = {
          pageIndex: --page.currentPage,
          pageSize: page.pageSize,
          username: formValues.username || undefined,
          isSuccess: formValues.isSuccess,
          startDate,
          endDate,
          path: '/api/admin/auth/login',
        };

        return await requestLogPageApi(params);
      },
    },
    sort: true,
  },
};

// 创建表格实例
const [Grid] = useVbenVxeGrid({
  gridOptions,
  formOptions: createSearchFormOptions(searchFormSchema),
});
</script>

<template>
  <Page auto-content-height>
    <Grid>
      <template #isSuccess="{ row }">
        <el-tag :type="row.isSuccess ? 'success' : 'danger'">
          {{ row.isSuccess ? '登录成功' : '登录失败' }}
        </el-tag>
      </template>
    </Grid>
  </Page>
</template>

<style scoped></style>
