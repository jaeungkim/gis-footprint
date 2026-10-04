import { createHash } from 'node:crypto';

// 불투명 페이지 토큰. k = 정렬 키 값(sort 순서), h = 검색 조건 해시.
// 조건이 바뀐 요청에 옛 토큰을 쓰면 h가 안 맞아서 400(AIP-158 규칙).
export interface TokenPayload {
  k: (string | number)[];
  h: string;
}

export function encodeToken(p: TokenPayload): string {
  return Buffer.from(JSON.stringify(p)).toString('base64url');
}

export function decodeToken(s: string): TokenPayload | null {
  try {
    const v: unknown = JSON.parse(Buffer.from(s, 'base64url').toString('utf8'));
    if (typeof v !== 'object' || v === null) return null;
    const { k, h } = v as { k?: unknown; h?: unknown };
    if (!Array.isArray(k) || typeof h !== 'string') return null;
    if (!k.every((x) => typeof x === 'string' || typeof x === 'number')) {
      return null;
    }
    return { k: k as (string | number)[], h };
  } catch {
    return null;
  }
}

export function conditionHash(conditions: unknown): string {
  return createHash('sha256')
    .update(stableStringify(conditions))
    .digest('hex')
    .slice(0, 16);
}

// 키 순서와 무관하게 같은 문자열. JSON.stringify는 키 순서를 보존해서 그대로 못 쓴다.
export function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (typeof v === 'object' && v !== null) {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v) ?? 'null';
}
