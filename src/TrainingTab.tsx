import { useEffect, useRef, useState } from 'react';
import { JobForm } from './JobForm';
import type { Job, Task } from './types';
import { createWebSocket, fetchJsonData, getUrl, handleFetchError } from './dataUtils';
import { getLogger } from './logging';
import { JobsTable } from './JobsTable';

// Web socket DTOs

interface JobInsertOrUpdate {
    type: 'job.insert' | 'job.update';
    job: Job;
}

interface JobDelete {
    type: 'job.delete';
    id: string;
}

type JobMessage = JobInsertOrUpdate | JobDelete;

const logger = getLogger('TrainingTab');

export function TrainingTab() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
    const socketRef = useRef<WebSocket | null>(null);
    const selectedJobIdRef = useRef<string | null>(null);

    useEffect(() => {
        selectedJobIdRef.current = selectedJobId;
    }, [selectedJobId]);

    useEffect(() => {
        logger.debug('useEffect on []');

        const controller = new AbortController();

        const { socket, promise } = createWebSocket(getUrl('ws/jobs').replace(/^http/, 'ws'), (event) => {
            try {
                logger.debug('received ws message', event.data);

                const message = JSON.parse(event.data) as JobMessage;
                switch (message.type) {
                    case 'job.insert': {
                        const { job } = message;
                        setJobs(prev => {
                            let index = prev.findIndex(j => j.datetime <= job.datetime);
                            if (index === -1)
                                index = prev.length;
                            return prev.toSpliced(index, 0, job);
                        });
                        break;
                    }
                    case 'job.update': {
                        const { job } = message;
                        setJobs(prev => {
                            const index = prev.findIndex(j => j.id === job.id);
                            if (index !== -1)
                                return prev.with(index, job);
                            return prev;
                        });
                        break;
                    }
                    case 'job.delete': {
                        const { id } = message;
                        if (id === selectedJobIdRef.current)
                            setSelectedJobId(null);
                        setJobs(prev => {
                            const index = prev.findIndex(j => j.id === id);
                            if (index !== -1)
                                return prev.toSpliced(index, 1);
                            return prev;
                        });
                        break;
                    }
                }
            } catch (error) {
                logger.error('error processing ws message', error);
            }
        });

        socketRef.current = socket;
        
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
            socketRef.current?.close();
            socketRef.current = null;
        };
    }, []);
    
    return (
        <div className='training-tab'>
            <JobForm tasks={tasks} />
            <JobsTable jobs={jobs} tasks={tasks} selectedJobId={selectedJobId} handleJobClick={setSelectedJobId} />
        </div>
    );
}