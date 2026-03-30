export interface Model {
    datetime: string;
    id: string;
    module: string;
    class: string;
    args: unknown[];
    kwArgs: { [key: string]: unknown };
    tag: string;
    trainableParams: number;
    minValLoss: number | null;
    maxValAccuracy: number | null;
    status: number;
}