import type { Job, JobLogMessage, MetricHistoryKey, MetricHistoryValue, Model } from "@/types";

export interface MessageHandlers<T> {
    onInsert(obj: T): void;
    onUpdate(obj: T): void;
    onDelete(id: string): void;
}

export interface ModelsChangeNotifier {
    subscribeTag(tag: string): void;
    unsubscribeTag(tag: string): void;
    subscribeMetricHistory(keys: MetricHistoryKey[]): void;
    unsubscribeMetricHistory(keys: MetricHistoryKey[]): void;
    start(): Promise<void>;
    cleanup(): Promise<void>;
}

export interface ModelsMessageHandlers extends MessageHandlers<Model> {
    onUpdateMetricHistory(value: MetricHistoryValue): void;
}

export interface JobsChangeNotifier {
    subscribeJob(id: string): void;
    unsubscribeJob(id: string): void;
    start(): Promise<void>;
    cleanup(): Promise<void>;
}

export interface JobsMessageHandlers extends MessageHandlers<Job> {
    onUpdateLogs(message: JobLogMessage): void;
}

export interface MessagingPlugin {
    getModelsChangeNotifier(messageHandlers: ModelsMessageHandlers): ModelsChangeNotifier;
    getJobsChangeNotifier(messageHandlers: JobsMessageHandlers): JobsChangeNotifier;
}