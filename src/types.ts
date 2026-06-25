export const ModelStatus = {
    Training: 'Training',
    Trained: 'Trained'
} as const;

export type ModelStatus = typeof ModelStatus[keyof typeof ModelStatus];

export interface Model {
    id: string;
    datetime: string;
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

export interface MetricHistoryKey {
    id: string;
    metricName: string;
}

export interface MetricHistoryValue {
    id: string;
    metricName: string;
    index: number;
    value: number;
}

export interface Task {
    id: string;
    fullClassName: string;
}

export const JobStatus = {
    Submitted: 'Submitted',
    Running: 'Running',
    Completed: 'Completed',
    Failed: 'Failed',
    Stopping: 'Stopping',
    Stopped: 'Stopped'
} as const;

export type JobStatus = typeof JobStatus[keyof typeof JobStatus];

export interface Job {
    id: string;
    datetime: string;
    taskId: string;
    args: unknown[];
    kwargs: { [key: string]: unknown };
    status: JobStatus;
    modelId: string | null;
}

export interface JobLogMessage {
    id: string;
    index: number;
    message: string;
}
