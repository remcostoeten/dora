import React, { useEffect, useState, useCallback } from 'react';
import { X, Download, Github } from 'lucide-react';

type Props = {
  githubUrl?: string;
  onClose?: () => void;
  position?: 'top' | 'bottom';
  defaultVisible?: boolean;
}

export function DemoBanner({
  githubUrl = 'https://github.com/remcostoeten/dora/releases',
  onClose,
  position = 'top',
  defaultVisible = true,
}: Props) {
  const [os, setOs] = useState<string>('your operating system');
  const [isVisible, setIsVisible] = useState<boolean>(defaultVisible);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    const isWebDemo = 
        import.meta.env.MODE === 'demo' || 
        window.location.hostname.includes('demo') || 
        import.meta.env.VITE_IS_WEB === 'true' ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';
        
    setIsDemo(isWebDemo);

    if (isWebDemo) {
        const userAgent = window.navigator.userAgent.toLowerCase();
        if (userAgent.indexOf('win') !== -1) {
        setOs('Windows');
        } else if (userAgent.indexOf('mac') !== -1) {
        setOs('macOS');
        } else if (userAgent.indexOf('linux') !== -1) {
        setOs('Linux');
        } else {
        setOs('your operating system');
        }
    }
  }, []);

  const handleClose = useCallback(() => {
    setIsVisible(false);
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  if (!isVisible || !isDemo) return null;

  return (
    <div
      className={`relative w-full flex items-center justify-center px-4 py-3 transition-all duration-300 ${
        position === 'top' ? 'border-b' : 'border-t'
      } ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full pointer-events-none'
      }`}
      style={{
        backgroundColor: '#111111',
        borderColor: '#303030',
      }}
    >
      <div className="flex items-center gap-3 max-w-5xl w-full">
        <div className="flex items-center justify-center w-8 h-8 rounded-md" style={{ backgroundColor: 'oklab(0.24 0 0 / 0.3)' }}>
          <Github className="w-4 h-4" style={{ color: 'oklab(1 0 0 / 0.8)' }} />
        </div>
                
        <div className="flex-1 flex items-center gap-2 text-sm">
          <span style={{ color: 'oklab(1 0 0 / 0.6)' }}>
            You're viewing the demo application.
          </span>
          <span style={{ color: 'oklab(1 0 0 / 0.95)' }}>
            Download the desktop client for {os}
          </span>
        </div>

        <a
          href={githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all hover:opacity-90"
          style={{
            backgroundColor: '#fafafa',
            color: '#111111',
          }}
        >
          <Download className="w-4 h-4" />
          Download
        </a>

        <button
          onClick={handleClose}
          className="flex items-center justify-center w-8 h-8 rounded-md transition-all hover:opacity-80"
          style={{
            backgroundColor: 'oklab(0.24 0 0 / 0.3)',
            color: 'oklab(1 0 0 / 0.6)',
          }}
          aria-label="Close banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
