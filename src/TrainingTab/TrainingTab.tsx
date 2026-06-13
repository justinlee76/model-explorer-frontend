import { useEffect, useRef, useState } from 'react';
import type { Job, Task } from '@/types';
import { createWebSocket, fetchJsonData, getUrl, handleFetchError } from '@/dataUtils';
import { getLogger } from '@/logging';
import { JobForm } from './JobForm';
import { JobsTable } from './JobsTable';
import { JobMessageList } from './JobMessageList';

interface TrainingTabProps {
    active: boolean
}

// Web socket DTOs

interface JobInsertOrUpdate {
    type: 'job.insert' | 'job.update';
    job: Job;
}

interface JobDelete {
    type: 'job.delete';
    id: string;
}

interface JobMessagesRequest {
    type: 'job.messages.subscribe' | 'job.messages.unsubscribe';
    id: string;
}

interface JobMessagesUpdate {
    type: 'job.messages.update';
    id: string;
    index: number;
    message: string;
}

type JobMessage = JobInsertOrUpdate | JobDelete | JobMessagesUpdate;

const logger = getLogger('TrainingTab');

export function TrainingTab({ active }: TrainingTabProps) {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
    const [jobMessages, setJobMessages] = useState<string[]>([]);

    const socketRef = useRef<WebSocket | null>(null);
    const selectedJobIdRef = useRef<string | null>(null);

    const sendMessage = (message: JobMessagesRequest): boolean => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            try {
                logger.debug('sending message over ws', message);
                socketRef.current.send(JSON.stringify(message));
                return true;
            } catch (error) {
                logger.error('error sending message', error);
            }
        }
        else
            logger.warn('Unable to send message as open socket not available');
        return false;
    };


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
                        break;
                    }
                    case 'job.messages.update': {
                        const { id, index, message: jobMessage } = message;
                        if (id === selectedJobIdRef.current) {
                            setJobMessages(prev => {
                                const jobMessages = [...prev];
                                jobMessages[index] = jobMessage;
                                return jobMessages;
                            });
                        }
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

    useEffect(() => {
        logger.debug('useEffect on [selectedJobId]');
        
        selectedJobIdRef.current = selectedJobId;

        if (!selectedJobId)
            return;

        sendMessage({ type: 'job.messages.subscribe', id: selectedJobId });

        fetchJsonData<string[]>(getUrl(`jobs/${selectedJobId}/messages`))
            .then(setJobMessages)
            .catch(handleFetchError);

        return () => {
            sendMessage({ type: 'job.messages.unsubscribe', id: selectedJobId });
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