import { Square, Trash2 } from "lucide-react";
import { fetchJsonData, getUrl, handleFetchError } from "./dataUtils";
import { formatColumnValue, type AnyColDef, type ColDef } from "./tableUtils";
import type { Job, Task } from "./types";
import { ICON_SIZE, STROKE_WIDTH } from "./constants";

interface JobsTableProps {
    jobs: Job[];
    tasks: Task[];
    selectedJobId: string | null;
    handleJobClick: (id: string) => void;
}

interface JobView extends Job {
    taskName: string;
}

const colDefs: AnyColDef<JobView>[] = [
    {
        key: 'datetime', name: 'Date & Time', format: v =>
            new Date(v).toLocaleString(undefined, {
                year: 'numeric',
                month: 'numeric',
                day: 'numeric',
                hour12: false,
                hour: 'numeric',
                minute: 'numeric',
            })
    },
    { key: 'id', name: 'Id' },
    { key: 'taskName', name: 'Task' },
    { key: 'args', name: 'Args' },
    { key: 'kwargs', name: 'KWArgs' },
    { key: 'modelId', name: 'Model Id' },
    { key: 'status', name: 'Status' }
];

const stopJob = (id: string) => {
    fetchJsonData(getUrl('stop-job'), undefined, 'POST', { id })
        .catch(handleFetchError);
};

const deleteJob = (id: string) => {
    fetchJsonData(getUrl(`delete-job/${id}`), undefined, 'DELETE')
        .catch(handleFetchError);
};

const getActionButton = (job: JobView) => {
    switch (job.status) {
        case 'Running':
            return (
                <button className='job-action' title='Stop job' onClick={(e) => { stopJob(job.id); e.stopPropagation(); }}>
                    <Square size={ICON_SIZE} color='red' fill='red' strokeWidth={STROKE_WIDTH} />
                </button>
            );
        case 'Stopping':
            return (
                <button className='job-action' title='Stopping...'>
                    <Square size={ICON_SIZE} color='lightgray' fill='lightgray' strokeWidth={STROKE_WIDTH} />
                </button>
            );
        default:
            return (
                <button className='job-action' title='Delete job' onClick={(e) => { deleteJob(job.id); e.stopPropagation(); }}>
                    <Trash2 size={ICON_SIZE} strokeWidth={STROKE_WIDTH} />
                </button>
            );
    };
};

export function JobsTable({jobs, tasks, selectedJobId, handleJobClick}: JobsTableProps) {
    const taskNames = new Map(
        tasks.map(t => [t.id, t.fullClassName])
    );
    const jobsView = jobs.map(j => ({...j, taskName: taskNames.get(j.taskId) ?? j.taskId }));
    return (
        <div className='jobs-container'>
            <table className='data-table selectable-table'>
                <thead>
                    <tr>
                        {colDefs.map(c => <th key={c.key}>{c.name}</th>)}
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {jobsView.map(j =>
                        <tr key={j.id} className={j.id === selectedJobId ? 'selected-row' : ''} onClick={() => handleJobClick(j.id)}>
                            {colDefs.map(c =>
                                <td key={c.key}>
                                    {formatColumnValue(j, c as ColDef<JobView, typeof c.key>)}
                                </td>)}
                            <td key='action'>{getActionButton(j)}
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
