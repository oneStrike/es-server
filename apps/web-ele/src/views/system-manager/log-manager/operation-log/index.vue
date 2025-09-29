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

import { operationLogColumns, searchFormSchema } from './shared';

// 表格配置
const gridOptions: VxeGridProps<RequestLogDto> = {
  columns: operationLogColumns,
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
          ip: formValues.ip || undefined,
          apiType: formValues.apiType || undefined,
          method: formValues.method || undefined,
          path: formValues.path || undefined,
          actionType: formValues.actionType || undefined,
          isSuccess: formValues.isSuccess,
          startDate,
          endDate,
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
      <template #method="{ row }">
        <el-tag
          :type="
            row.method === 'GET'
              ? 'info'
              : row.method === 'POST'
                ? 'success'
                : row.method === 'PUT'
                  ? 'warning'
                  : row.method === 'DELETE'
                    ? 'danger'
                    : 'primary'
          "
          size="small"
        >
          {{ row.method }}
        </el-tag>
      </template>

      <template #isSuccess="{ row }">
        <el-tag :type="row.isSuccess ? 'success' : 'danger'" size="small">
          {{ row.isSuccess ? '操作成功' : '操作失败' }}
        </el-tag>
      </template>
    </Grid>
  </Page>
</template>

<style scoped></style>
