/** PagedResultDto<T>: answer of the task list endpoints. `page` starts at 1; `pageSize` is 1 to 100. */
export interface PagedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}
