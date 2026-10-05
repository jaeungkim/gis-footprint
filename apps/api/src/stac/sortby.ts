import { BadRequestException } from '@nestjs/common';
import type { SortSpec } from '../catalog/interfaces/scene-query.interface.js';
import { SORTABLE_NAMES, SORTABLES } from './queryables.js';

export const MAX_SORT_FIELDS = 3;

export interface SortbyItem {
  field: string;
  direction: 'asc' | 'desc';
}

// GET 형식 "+field,-field". 접두사가 없으면 asc.
export function parseSortbyParam(s: string): SortbyItem[] {
  return s
    .split(',')
    .filter(Boolean)
    .map((part) => ({
      field: part.replace(/^[+-]/, ''),
      direction: part.startsWith('-') ? 'desc' : 'asc',
    }));
}

// 기본은 최신순. id가 없으면 끝에 id desc를 붙여 전순서(커서용)를 만든다.
export function resolveSort(items: SortbyItem[] | undefined): SortSpec[] {
  const requested = items ?? [
    { field: 'properties.datetime', direction: 'desc' },
  ];
  if (requested.length > MAX_SORT_FIELDS) {
    throw new BadRequestException(`sortby: 최대 ${MAX_SORT_FIELDS}개`);
  }

  const specs: SortSpec[] = requested.map(({ field, direction }) => {
    const key = SORTABLES[field];
    if (!key) {
      throw new BadRequestException(
        `sortby: 정렬할 수 없는 필드 ${field} (가능: ${SORTABLE_NAMES.join(', ')})`,
      );
    }

    return { key, dir: direction };
  });

  if (!specs.some((s) => s.key === 'id'))
    specs.push({ key: 'id', dir: 'desc' });

  return specs;
}
