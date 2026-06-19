export const toJson = (value: unknown): string => JSON.stringify(value);

export const fromJson = <TValue>(value: string): TValue => JSON.parse(value) as TValue;

export const toSqlBoolean = (value: boolean): number => (value ? 1 : 0);

export const fromSqlBoolean = (value: unknown): boolean => Number(value) === 1;
