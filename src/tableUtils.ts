export interface ColDef<T, K extends keyof T> {
    key: K;
    name: string;
    format?: (v: T[K]) => string;
}

export type AnyColDef<T> = { [K in keyof T]: ColDef<T, K> }[keyof T];

export const formatColumnValue = <T, K extends keyof T>(row: T, col: ColDef<T, K>): string => {
    const val = row[col.key];
    if (typeof col.format === 'undefined') {
        if (val === null)
            return '';
        return typeof val === 'object' ? JSON.stringify(val) : String(val);
    }
    return col.format(val);
};
