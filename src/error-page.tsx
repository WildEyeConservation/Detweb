import { useRouteError, useNavigate } from 'react-router-dom';
import { Button } from 'react-bootstrap';
import { useState } from 'react';

interface ErrorWithDetails {
  message?: string;
  statusText?: string;
  status?: number;
  stack?: string;
}

export default function ErrorPage() {
  const error = useRouteError();
  const navigate = useNavigate();
  const [copySuccess, setCopySuccess] = useState(false);
  console.error(error);

  const errorObj = error as ErrorWithDetails;

  const handleGoHome = () => {
    navigate('/');
  };

  const handleCopyStackTrace = async () => {
    try {
      const errorDetails = {
        message: errorObj?.message || errorObj?.statusText || 'Unknown error',
        status: errorObj?.status || 'N/A',
        stack: errorObj?.stack || 'No stack trace available',
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      };

      const stackTraceText = `
Error Details:
-------------
Message: ${errorDetails.message}
Status: ${errorDetails.status}
Timestamp: ${errorDetails.timestamp}
URL: ${errorDetails.url}
User Agent: ${errorDetails.userAgent}

Stack Trace:
-------------
${errorDetails.stack}
      `.trim();

      await navigator.clipboard.writeText(stackTraceText);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 5000); // Reset success message after 2 seconds
    } catch (err) {
      console.error('Failed to copy stack trace:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = `Error: ${
        errorObj.message || errorObj.statusText
      }\nStack: ${errorObj.stack || 'No stack trace'}`;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const errorMessage =
    errorObj?.message || errorObj?.statusText || 'Unknown error';

  return (
    <div
      id='error-page'
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: 'var(--ss-content-bg)',
      }}
    >
      <div
        className='ss-card'
        style={{
          maxWidth: 480,
          width: '100%',
          textAlign: 'center',
          padding: '32px 28px',
        }}
      >
        <h1
          style={{
            fontSize: 28,
            marginBottom: 8,
            color: 'var(--ss-text)',
          }}
        >
          Oops!
        </h1>
        <p style={{ color: 'var(--ss-text-muted)', marginBottom: 6 }}>
          Sorry, an unexpected error has occurred.
        </p>
        {errorMessage && (
          <p
            style={{
              color: 'var(--ss-text-dim)',
              fontSize: 13,
              marginBottom: 24,
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              wordBreak: 'break-word',
            }}
          >
            {errorMessage}
          </p>
        )}
        <div
          className='d-flex justify-content-center gap-2'
          style={{ marginTop: 8 }}
        >
          <Button variant='primary' onClick={handleGoHome}>
            Back to Surveys
          </Button>
          <Button variant='secondary' onClick={handleCopyStackTrace}>
            {copySuccess ? 'Copied!' : 'Copy Error Details'}
          </Button>
        </div>
        {copySuccess && (
          <p
            style={{
              color: 'var(--ss-green)',
              fontSize: 12,
              marginTop: 14,
              marginBottom: 0,
            }}
          >
            Error details copied to clipboard — please send this to our support
            team.
          </p>
        )}
      </div>
    </div>
  );
}
