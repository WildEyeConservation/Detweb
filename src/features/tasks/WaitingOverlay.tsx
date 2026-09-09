

// Subtle loading overlay component for when waiting for new work
export function WaitingOverlay({ message }: { message: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1000,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        borderRadius: '12px',
        padding: '20px 32px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
      }}
    >
      <div
        style={{
          width: '32px',
          height: '32px',
          border: '3px solid rgba(255, 255, 255, 0.2)',
          borderTopColor: '#fff',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}
      />
      <style>
        {`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
      <div
        style={{
          color: '#fff',
          fontSize: '14px',
          textAlign: 'center',
          maxWidth: '280px',
        }}
      >
        {message}
      </div>
    </div>
  );
}
