import { useLayoutEffect, useRef } from 'react';
import { getLogger } from '@/logging';

const logger = getLogger('JobMessageList');

interface JobMessageListProps {
    active: boolean,
    messages: string[]
}

export function JobMessageList({ active, messages }: JobMessageListProps) {
    const divRef = useRef<HTMLDivElement | null>(null);

    useLayoutEffect(() => {
        logger.debug('useEffect on [active, messages]');
        if (active)
            divRef.current?.lastElementChild?.scrollIntoView({ block: 'end' });
    }, [active, messages]);

    return (
        <div ref={divRef} className='job-messages'>
            {messages.map((m, i) => <div key={i}>{m}</div>)}
        </div>
    );
}