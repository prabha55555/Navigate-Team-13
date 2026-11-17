import { memo, useEffect, useRef, useState } from 'react';

// Optionally, you can use face-api.js or similar for advanced detection
// For now, we'll just check that the camera feed is live using getUserMedia

const CHECK_INTERVAL_MS = 3000;
// The preview is 120x90, so a small capture keeps decode/compositing cheap.
const VIDEO_CONSTRAINTS = {
  video: { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 15 } },
  audio: false
};

/**
 * Shows a small webcam preview and reports camera problems.
 * onViolation(reason) fires once each time the feed goes from OK to broken;
 * onRecover() fires when it comes back.
 */
const ProctoringWebcam = ({ onViolation, onRecover }) => {
  const videoRef = useRef(null);
  const [violation, setViolation] = useState(false);

  // Keep the latest callbacks without restarting the camera when they change.
  const onViolationRef = useRef(onViolation);
  const onRecoverRef = useRef(onRecover);
  useEffect(() => {
    onViolationRef.current = onViolation;
    onRecoverRef.current = onRecover;
  }, [onViolation, onRecover]);

  useEffect(() => {
    // The <video> is always rendered, so the element is available here.
    const video = videoRef.current;
    let stream = null;
    let interval = null;
    let cancelled = false;
    let inViolation = false;

    const report = (broken, reason) => {
      if (cancelled || broken === inViolation) return;
      inViolation = broken;
      setViolation(broken);
      if (broken) {
        if (onViolationRef.current) onViolationRef.current(reason);
      } else if (onRecoverRef.current) {
        onRecoverRef.current();
      }
    };

    const checkFeed = () => {
      const track = stream && stream.getVideoTracks()[0];
      if (!video || !track) return;
      const trackDead = track.readyState === 'ended' || !track.enabled;
      const videoStopped = video.readyState >= 2 && (video.paused || video.ended);
      report(trackDead || videoStopped, 'Camera feed interrupted');
    };

    const startWebcam = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia(VIDEO_CONSTRAINTS);
        if (cancelled) {
          // Unmounted while the permission prompt was open: release the camera.
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = mediaStream;
        if (video) {
          video.srcObject = stream;
        }
        stream.getVideoTracks().forEach((track) => {
          track.addEventListener('ended', checkFeed);
        });
        interval = setInterval(checkFeed, CHECK_INTERVAL_MS);
      } catch (err) {
        report(true, 'Camera not accessible');
      }
    };

    startWebcam();

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      if (stream) {
        stream.getTracks().forEach((track) => {
          track.removeEventListener('ended', checkFeed);
          track.stop();
        });
      }
      if (video) {
        video.srcObject = null;
      }
    };
  }, []);

  return (
    // zIndex 1200: above the app bar (1100) but below MUI dialogs (1300), so the
    // submit confirmation is never covered by the preview.
    <div style={{ position: 'fixed', bottom: 10, right: 10, zIndex: 1200, background: '#fff', border: '1px solid #ccc', borderRadius: 8, padding: 4 }}>
      <video ref={videoRef} width={120} height={90} autoPlay muted playsInline style={{ borderRadius: 8, background: '#000' }} />
      {violation && <div style={{ color: 'red', fontWeight: 'bold', fontSize: 12 }}>Camera Violation!</div>}
    </div>
  );
};

export default memo(ProctoringWebcam);
