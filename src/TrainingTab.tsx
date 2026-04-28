import { useEffect, useState } from 'react';
import { JobForm } from './JobForm';
import type { Job, Task } from './types';
import { fetchJsonData, getUrl, handleFetchError } from './dataUtils';
import { getLogger } from './logging';
import { JobsTable } from './JobsTable';

const logger = getLogger('TrainingTab');

export function TrainingTab() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

    useEffect(() => {
        logger.debug('useEffect on []');

        const controller = new AbortController();

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

        return () => {
            controller.abort();
        };
    }, []);
    
    return (
        <div className='training-tab'>
            <JobForm tasks={tasks} />
            <JobsTable jobs={jobs} tasks={tasks} selectedJobId={selectedJobId} handleJobClick={setSelectedJobId} />
        </div>
    );
}