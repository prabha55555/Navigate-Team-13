import { useEffect, useRef, useState } from 'react';

// Optionally, you can use face-api.js or similar for advanced detection
// For now, we'll just check if a face is present using the browser's getUserMedia

const ProctoringWebcam = ({ onViolation }) => {
  const videoRef = useRef(null);
  const [violation, setViolation] = useState(false);

  useEffect(() => {
    let stream;
    let interval;
    const startWebcam = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        // Simple check: if video is playing, assume face is present
        interval = setInterval(() => {
          if (videoRef.current && videoRef.current.readyState === 4) {
            // If video is paused or ended, trigger violation
            if (videoRef.current.paused || videoRef.current.ended) {
              setViolation(true);
              onViolation && onViolation('Camera feed interrupted');
            } else {
              setViolation(false);
            }
          }
        }, 3000);
      } catch (err) {
        setViolation(true);
        onViolation && onViolation('Camera not accessible');
      }
    };
    startWebcam();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (interval) clearInterval(interval);
    };
  }, [onViolation]);

  return (
    <div style={{ position: 'fixed', bottom: 10, right: 10, zIndex: 9999, background: '#fff', border: '1px solid #ccc', borderRadius: 8, padding: 4 }}>
      <video ref={videoRef} width={120} height={90} autoPlay muted style={{ borderRadius: 8, background: '#000' }} />
      {violation && <div style={{ color: 'red', fontWeight: 'bold', fontSize: 12 }}>Camera Violation!</div>}
    </div>
  );
};

export default ProctoringWebcam;
