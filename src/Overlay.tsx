import { X } from 'lucide-react'
import { useEffect } from 'react';

interface OverlayProps {
    show: boolean;
    onClose: () => void;
    children: React.ReactNode;
}

export function Overlay({show, onClose, children}: OverlayProps) {
    useEffect(() => {
        if (!show)
            return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape')
                onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [show, onClose]);

    if (!show)
        return null;

    return (
        <div className='overlay-backdrop'>
            <div className='overlay-content'>
                <button className='overlay-close-button' onClick={onClose}><X size={24} strokeWidth={1.5} /></button>
                {children}
            </div>
        </div>
    );
}