export interface Model {
    datetime: string;
    id: string;
    module: string;
    className: string;
    args: unknown[];
    kwargs: { [key: string]: unknown };
    tag: string;
    trainableParams: number;
    minValLoss: number | null;
    maxValAccuracy: number | null;
    status: number;
}