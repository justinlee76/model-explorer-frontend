import { useEffect, useState } from 'react';
import { useForm, type FieldErrors, type UseFormRegister } from 'react-hook-form';
import { fetchJsonData, getUrl, handleFetchError } from './dataUtils';
import { Plus, ArrowUp } from 'lucide-react';
import { ICON_SIZE, STROKE_WIDTH } from './constants';
import { getLogger } from './logging';
import { Overlay } from './Overlay';
import type { Task } from './types';

interface JobInputs {
    taskId: string;
    args: unknown[];
    kwargs: { [key: string]: unknown };
}

type JobFormValues = {
    [K in keyof JobInputs]: string
};

interface AddJobResponse {
    id: string | null;
}

const logger = getLogger('JobForm');

const validateArgs = (args: string): true | string  => {
  try {
    const obj = JSON.parse(args);
    return Array.isArray(obj) || 'Array expected';
  } catch {
    return 'Invalid JSON';
  }
};

const validateKwargs = (kwargs: string): true | string  => {
  try {
    const obj = JSON.parse(kwargs);
    if (typeof obj === 'object' && obj !== null)
        return !Array.isArray(obj) || 'Object cannot be an array';
    else
        return 'Object expected'
  } catch {
    return 'Invalid JSON';
  }
};

interface JobFormProps {
    tasks: Task[];
}

export function JobForm({tasks}: JobFormProps) {
    const [message, setMessage] = useState('');
    const [showJobForm, setShowJobForm] = useState(false);

    const { register, handleSubmit, formState: { errors, isValid }, reset } = useForm<JobFormValues>({
        mode: 'onBlur',
        reValidateMode: 'onBlur',
        defaultValues: { 'taskId': '', 'args': '[]', 'kwargs': '{}' }
    });

    const handleJobSubmitError = (error: unknown) => {
        let details: string
        if (typeof error === 'string') {
            details = error;
        } else if (error instanceof Error) {
            details = error.message;
        } else {
            details = `Unknown error ${error}`;
        }
        const message = `Error submitting job: ${details}`;
        logger.error(message);
        setMessage(message);
    };

    const onSubmit = (data: JobFormValues) => {
        logger.debug('training job form data', data);
        
        try {
            const args = JSON.parse(data.args);
            const kwargs = JSON.parse(data.kwargs);
            const request: JobInputs = {
                taskId: data.taskId,
                args,
                kwargs
            };
            fetchJsonData<AddJobResponse>(getUrl('add-job'), undefined, 'POST', request)
                .then(data => setMessage(`Submitted job ID: ${data.id}`))
                .catch(handleJobSubmitError)
                .finally(() => setShowJobForm(false));
        } catch (error: unknown) {
            handleJobSubmitError(error);
        }
    };

    useEffect(() => {
        logger.debug('useEffect on [reset]');

        const controller = new AbortController();

        fetchJsonData<JobInputs>(getUrl('job-defaults'), controller.signal)
            .then(data => {
                reset({
                    taskId: data.taskId,
                    args: JSON.stringify(data.args, null, 2),
                    kwargs: JSON.stringify(data.kwargs, null, 2)
                });
            })
            .catch(handleFetchError);

        return () => {
            controller.abort();
        };
    }, [reset]);

    return (
        <>
            <div className='job-submission'>
                <button className='simple-button' onClick={() => setShowJobForm(true)}><Plus size={ICON_SIZE} strokeWidth={STROKE_WIDTH} />Add job</button>
                {message.length > 0 && <div className='job-message'>{message}</div>}
            </div>
            <Overlay show={showJobForm} onClose={() => setShowJobForm(false)}>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <div>
                        <label htmlFor='taskId'>Task</label>
                        <select id='taskId' {...register('taskId')}>
                            {tasks.map(t =>
                                <option key={t.id} value={t.id}>{t.fullClassName}</option>
                            )}
                        </select>
                    </div>
                    <div className='args-container'>
                        <ArgsInput label='args' register={register} validate={validateArgs} errors={errors} />
                        <ArgsInput label='kwargs' register={register} validate={validateKwargs} errors={errors} />
                    </div>

                    <button type='submit' disabled={!isValid} className='simple-button'><ArrowUp size={ICON_SIZE} strokeWidth={STROKE_WIDTH} />Submit</button>
                </form>
            </Overlay>
        </>
    );
}

interface ArgsInputProps {
    label: keyof JobFormValues;
    register: UseFormRegister<JobFormValues>;
    validate: (value: string) => true | string;
    errors: FieldErrors<JobFormValues>;
}

function ArgsInput({label, register, validate, errors}: ArgsInputProps) {
    return (
        <div className='args'>
            <label htmlFor={label}>{label}</label>
            <textarea id={label} rows={20} cols={40} {...register(label, {validate: validate})} />
            <p className='validation-error'>{errors[label] && errors[label].message}</p>
        </div>
    );
}