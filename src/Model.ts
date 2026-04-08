export const ModelStatus = {
    Training: 0,
    Trained: 1
} as const;

export type ModelStatus = typeof ModelStatus[keyof typeof ModelStatus];

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
    status: ModelStatus;
}