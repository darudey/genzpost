
"use client";

import { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Button } from './button';

export function FloatingCropBar({
  onDone,
  onCancel,
}: {
  onDone: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onDone();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDone, onCancel]);

  return ReactDOM.createPortal(
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex gap-2">
      <Button
        onClick={onCancel}
        variant="secondary"
        className="bg-black/70 text-white hover:bg-black/90 shadow-lg"
      >
        Cancel
      </Button>
      <Button
        onClick={onDone}
        className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg"
      >
        Done
      </Button>
    </div>,
    document.body
  );
}
