import { RouterProvider } from 'react-router';
import { router } from './routes';
import { Toaster } from 'sonner';
import NetworkStatusBanner from './components/NetworkStatusBanner';

export default function App() {
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