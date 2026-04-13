import { apiFetch, createQueryString, type ApiSuccessResponse } from './api';

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => unknown;
}

interface ExportPaginatedApiCsvOptions<T> {
  path: string;
  params?: Record<string, string | number | boolean | undefined>;
  columns: CsvColumn<T>[];
  filename: string;
  auth?: boolean;
  limit?: number;
}

function normalizeCellValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeCellValue(item)).filter(Boolean).join(' | ');
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

function escapeCsvValue(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

function triggerCsvDownload(filename: string, content: string) {
  const blob = new Blob([`\uFEFF${content}`], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportRowsToCsv<T>(
  rows: T[],
  columns: CsvColumn<T>[],
  filename: string,
): number {
  const header = columns.map((column) => escapeCsvValue(column.header)).join(',');
  const body = rows.map((row) =>
    columns
      .map((column) => escapeCsvValue(normalizeCellValue(column.value(row))))
      .join(','),
  );

  triggerCsvDownload(filename, [header, ...body].join('\n'));
  return rows.length;
}

export async function fetchAllPaginatedRecords<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined> = {},
  options: { auth?: boolean; limit?: number } = {},
): Promise<T[]> {
  // Most list endpoints cap page size at 100 via DTO validation.
  const limit = options.limit ?? 100;
  const auth = options.auth ?? true;
  const rows: T[] = [];
  let page = 1;
  let total = Number.POSITIVE_INFINITY;

  while (rows.length < total) {
    const response = await apiFetch<ApiSuccessResponse<T[]>>(
      `${path}${createQueryString({
        ...params,
        page,
        limit,
      })}`,
      { auth },
    );

    rows.push(...response.data);

    if (!response.meta) {
      break;
    }

    total = response.meta.total;

    if (response.data.length === 0 || rows.length >= total) {
      break;
    }

    page += 1;
  }

  return rows;
}

export async function exportPaginatedApiCsv<T>({
  path,
  params,
  columns,
  filename,
  auth,
  limit,
}: ExportPaginatedApiCsvOptions<T>): Promise<number> {
  const rows = await fetchAllPaginatedRecords<T>(path, params, {
    auth,
    limit,
  });

  return exportRowsToCsv(rows, columns, filename);
}

export function buildCsvFilename(baseName: string) {
  const stamp = new Date().toISOString().slice(0, 10);
  const normalizedBase = baseName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${normalizedBase || 'export'}-${stamp}.csv`;
}
