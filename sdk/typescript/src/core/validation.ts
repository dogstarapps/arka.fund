export type IntLike = bigint | number | string;

const MAX_I128 = (1n << 127n) - 1n;
const MAX_U128 = (1n << 128n) - 1n;

export function ensureNonEmptyString(value: string, field: string): string {
  if (value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }
  return value;
}

export function ensureSorobanAddress(value: string, field: string): string {
  ensureNonEmptyString(value, field);
  if (!/^[A-Z2-7]{56}$/.test(value)) {
    throw new Error(`${field} must be a valid Soroban address or contract id`);
  }
  return value;
}

export function toBigInt(value: IntLike, field: string): bigint {
  if (typeof value === "bigint") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isInteger(value)) {
      throw new Error(`${field} must be an integer`);
    }
    return BigInt(value);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return BigInt(value);
  }
  throw new Error(`${field} must be an integer-like value`);
}

export function ensurePositiveInt(value: IntLike, field: string): bigint {
  const normalized = toBigInt(value, field);
  if (normalized <= 0n) {
    throw new Error(`${field} must be greater than zero`);
  }
  return normalized;
}

export function ensureNonNegativeInt(value: IntLike, field: string): bigint {
  const normalized = toBigInt(value, field);
  if (normalized < 0n) {
    throw new Error(`${field} must not be negative`);
  }
  return normalized;
}

export function ensurePositiveInt128(value: IntLike, field: string): bigint {
  const normalized = ensurePositiveInt(value, field);
  if (normalized > MAX_I128) {
    throw new Error(`${field} exceeds the signed 128-bit range`);
  }
  return normalized;
}

export function ensureNonNegativeInt128(value: IntLike, field: string): bigint {
  const normalized = ensureNonNegativeInt(value, field);
  if (normalized > MAX_I128) {
    throw new Error(`${field} exceeds the signed 128-bit range`);
  }
  return normalized;
}

export function ensureUint128(value: IntLike, field: string): bigint {
  const normalized = ensureNonNegativeInt(value, field);
  if (normalized > MAX_U128) {
    throw new Error(`${field} exceeds the unsigned 128-bit range`);
  }
  return normalized;
}

export function ensureNonEmptyBytes(value: Uint8Array, field: string): Uint8Array {
  if (value.length === 0) {
    throw new Error(`${field} must not be empty`);
  }
  return value;
}

export function ensureUint32(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff_ffff) {
    throw new Error(`${field} must be a uint32`);
  }
  return value;
}

export function ensureBps(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 0 || value > 10_000) {
    throw new Error(`${field} must be an integer between 0 and 10000`);
  }
  return value;
}
