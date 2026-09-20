import React, { useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes';
import { Toaster } from 'sonner';
import NetworkStatusBanner from './components/NetworkStatusBanner';

export default function App() {
  useEffect(() => {
    const restoreInteractivity = () => {
      try {
        if (document.body.style.pointerEvents === 'none') {
          document.body.style.pointerEvents = 'auto';
        }
        const oldIframe = document.getElementById('print-doc-iframe');
        if (oldIframe) oldIframe.remove();
        
        // Remove pointer-events from any closed dialog overlay
        document.querySelectorAll('[data-slot="dialog-overlay"]').forEach(el => {
          if ((el as HTMLElement).dataset.state === 'closed') {
            (el as HTMLElement).style.pointerEvents = 'none';
          }
        });
      } catch {}
    };

    // Watch for any unwanted body pointer-events: none
    const observer = new MutationObserver(() => {
      if (document.body.style.pointerEvents === 'none') {
        document.body.style.pointerEvents = 'auto';
      }
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['style'] });

    window.addEventListener('focus', restoreInteractivity);
    window.addEventListener('afterprint', restoreInteractivity);
    window.addEventListener('mouseup', restoreInteractivity);
    window.addEventListener('click', restoreInteractivity, { capture: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('focus', restoreInteractivity);
      window.removeEventListener('afterprint', restoreInteractivity);
      window.removeEventListener('mouseup', restoreInteractivity);
      window.removeEventListener('click', restoreInteractivity, { capture: true });
    };
  }, []);
  return (
    <>
      <NetworkStatusBanner />
      <Toaster
        position="top-right"
        theme="light"
        closeButton
        richColors
        duration={3200}
        toastOptions={{
          style: {
            borderRadius: '12px',
            fontSize: '13px',
            fontWeight: '500',
            boxShadow: '0 12px 30px -4px rgba(0, 0, 0, 0.12), 0 4px 8px -2px rgba(0, 0, 0, 0.05)',
            padding: '12px 16px',
            border: '1px solid rgba(226, 232, 240, 0.95)',
            backgroundColor: '#ffffff',
          },
          className: 'font-sans font-medium',
          classNames: {
            closeButton: '!left-auto !right-0 translate-x-[35%] -translate-y-[35%]',
          },
        }}
      />
      <RouterProvider router={router} />
    </>
  );
}