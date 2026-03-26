import { useState, useRef, useEffect, useCallback } from 'react';

export default function Dropdown({ value, onChange, options, className = '', placeholder = '—' }) {
  const [open, setOpen] = useState(false);
  const [focusIdx, setFocusIdx] = useState(-1);
  const ref = useRef(null);
  const listRef = useRef(null);

  const selected = options.find(o => (o.value ?? o) === value);
  const label = selected ? (selected.label ?? selected) : placeholder;

  const close = useCallback(() => { setOpen(false); setFocusIdx(-1); }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) close();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [open, close]);

  useEffect(() => {
    if (!open || focusIdx < 0 || !listRef.current) return;
    const item = listRef.current.children[focusIdx];
    if (item) item.scrollIntoView({ block: 'nearest' });
  }, [focusIdx, open]);

  const handleKey = (e) => {
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      if (focusIdx >= 0) {
        const opt = options[focusIdx];
        onChange(opt.value ?? opt);
        close();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      setFocusIdx(i => (i + 1) % options.length);
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      setFocusIdx(i => (i <= 0 ? options.length - 1 : i - 1));
    }
  };

  return (
    <div className={`dd ${className} ${open ? 'dd-open' : ''}`} ref={ref}>
      <button
        type="button"
        className="dd-trigger"
        onClick={() => setOpen(o => !o)}
        onKeyDown={handleKey}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="dd-value">{label}</span>
        <svg className="dd-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      {open && (
        <div className="dd-panel" role="listbox" ref={listRef}>
          {options.map((opt, i) => {
            const v = opt.value ?? opt;
            const l = opt.label ?? opt;
            const isActive = v === value;
            const isFocused = i === focusIdx;
            return (
              <div
                key={v}
                role="option"
                aria-selected={isActive}
                className={`dd-option ${isActive ? 'dd-option-active' : ''} ${isFocused ? 'dd-option-focus' : ''}`}
                onClick={() => { onChange(v); close(); }}
                onMouseEnter={() => setFocusIdx(i)}
              >
                {isActive && (
                  <svg className="dd-check" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M3 8.5l3.5 3.5 6.5-7" />
                  </svg>
                )}
                <span>{l}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
