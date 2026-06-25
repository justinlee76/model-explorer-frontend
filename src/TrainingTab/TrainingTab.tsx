import { useEffect, useRef, useState } from 'react';
import type { Job, Task } from '@/types';
import { fetchJsonData, getUrl, handleFetchError, messagingPlugin } from '@/dataUtils';
import { getLogger } from '@/logging';
import { JobForm } from './JobForm';
import { JobsTable } from './JobsTable';
import { JobMessageList } from './JobMessageList';
import type { JobsChangeNotifier } from '@/messaging/messaging.types';

interface TrainingTabProps {
    active: boolean
}

const logger = getLogger('TrainingTab');

export function TrainingTab({ active }: TrainingTabProps) {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
    const [jobMessages, setJobMessages] = useState<string[]>([]);

    const notifier = useRef<JobsChangeNotifier | null>(null);
    const selectedJobIdRef = useRef<string | null>(null);

    useEffect(() => {
        logger.debug('useEffect on []');

        const controller = new AbortController();

        notifier.current = messagingPlugin.getJobsChangeNotifier({
            onInsert(job) {
                setJobs(prev => {
                    let index = prev.findIndex(j => j.datetime <= job.datetime);
                    if (index === -1)
                        index = prev.length;
                    return prev.toSpliced(index, 0, job);
                });
            },
            onUpdate(job) {
                setJobs(prev => {
                    const index = prev.findIndex(j => j.id === job.id);
                    if (index !== -1)
                        return prev.with(index, job);
                    return prev;
                });
            },
            onDelete(id) {
                if (id === selectedJobIdRef.current) {
                    setSelectedJobId(null);
                    setJobMessages([]);
                }
                setJobs(prev => {
                    const index = prev.findIndex(j => j.id === id);
                    if (index !== -1)
                        return prev.toSpliced(index, 1);
                    return prev;
                });
            },
            onUpdateLogs(message) {
                const { id, index, message: jobMessage } = message;
                if (id === selectedJobIdRef.current) {
                    setJobMessages(prev => {
                        const jobMessages = [...prev];
                        jobMessages[index] = jobMessage;
                        return jobMessages;
                    });
                }
            }
        });

        const promise = notifier.current.start();
        
        promise.finally(() => {
            fetchJsonData<Task[]>(getUrl('tasks'), controller.signal)
                .then(setTasks)
                .catch(handleFetchError);

            fetchJsonData<Job[]>(getUrl('jobs'), controller.signal)
                .then(jobs => {
                    setJobs(jobs);
                    if (jobs.length > 0)
                        setSelectedJobId(jobs[0].id);
                })
                .catch(handleFetchError);            
        });

        return () => {
            controller.abort();
            notifier.current!.cleanup();
        };
    }, []);

    useEffect(() => {
        logger.debug('useEffect on [selectedJobId]');
        
        selectedJobIdRef.current = selectedJobId;

        if (!selectedJobId)
            return;

        const controller = new AbortController();

        notifier.current!.subscribeJob(selectedJobId);

        fetchJsonData<string[]>(getUrl(`jobs/${selectedJobId}/messages`), controller.signal)
            .then(setJobMessages)
            .catch(handleFetchError);

        return () => {
            controller.abort();
            notifier.current!.unsubscribeJob(selectedJobId);
        };
    }, [selectedJobId]);
    
    return (
        <div className='training-tab'>
            <JobForm tasks={tasks} />
            <JobsTable jobs={jobs} tasks={tasks} selectedJobId={selectedJobId} handleJobClick={setSelectedJobId} />
            <JobMessageList active={active} messages={jobMessages} />
        </div>
    );
}