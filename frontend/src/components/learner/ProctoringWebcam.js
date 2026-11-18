import VideocamOffRoundedIcon from '@mui/icons-material/VideocamOffRounded';
import { Box, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { memo, useEffect, useRef, useState } from 'react';

// Ported from the legacy components/student/ProctoringWebcam.js: the camera starts once per
// mount (stable effect, callbacks read through refs), is released on unmount even if the
// permission prompt is still open, and reports only OK -> broken -> OK transitions.

const CHECK_INTERVAL_MS = 3000;
// The preview is small, so a small capture keeps decode/compositing cheap.
const VIDEO_CONSTRAINTS = {
  video: { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 15 } },
  audio: false,
};

/**
 * Webcam preview that reports camera problems.
 * - onViolation(reason) fires once each time the feed goes from OK to broken
 * - onRecover() fires when it comes back
 * - onStatus('starting' | 'live' | 'blocked' | 'interrupted') for camera checks
 * variant: 'floating' (fixed bottom-right during the exam) | 'inline' (pre-start check)
 */
const ProctoringWebcam = ({ onViolation, onRecover, onStatus, variant = 'floating' }) => {
  const videoRef = useRef(null);
  const [violation, setViolation] = useState(false);

  const onViolationRef = useRef(onViolation);
  const onRecoverRef = useRef(onRecover);
  const onStatusRef = useRef(onStatus);
  useEffect(() => {
    onViolationRef.current = onViolation;
    onRecoverRef.current = onRecover;
    onStatusRef.current = onStatus;
  }, [onViolation, onRecover, onStatus]);

  useEffect(() => {
    // The <video> is always rendered, so the element is available here.
    const video = videoRef.current;
    let stream = null;
    let interval = null;
    let cancelled = false;
    let inViolation = false;

    const report = (broken, reason, status) => {
      if (cancelled) return;
      if (status && onStatusRef.current) onStatusRef.current(status);
      if (broken === inViolation) return;
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
      const broken = trackDead || videoStopped;
      report(broken, 'Camera feed interrupted', broken ? 'interrupted' : 'live');
    };

    const startWebcam = async () => {
      if (onStatusRef.current) onStatusRef.current('starting');
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera not supported');
        const mediaStream = await navigator.mediaDevices.getUserMedia(VIDEO_CONSTRAINTS);
        if (cancelled) {
          // Unmounted while the permission prompt was open: release the camera.
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = mediaStream;
        if (video) {
          video.srcObject = stream;
          video.play?.().catch(() => {});
        }
        stream.getVideoTracks().forEach((track) => {
          track.addEventListener('ended', checkFeed);
        });
        report(false, null, 'live');
        interval = setInterval(checkFeed, CHECK_INTERVAL_MS);
      } catch (err) {
        report(true, 'Camera not accessible', 'blocked');
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

  const inline = variant === 'inline';

  return (
    <Box
      sx={(theme) => ({
        ...(inline
          ? { position: 'relative', width: '100%', maxWidth: 320 }
          : {
              position: 'fixed',
              bottom: { xs: 76, md: 16 },
              right: 16,
              // Above the app bar (1100) but below dialogs (1300), so the submit dialog is never covered.
              zIndex: 1200,
              width: { xs: 96, sm: 132 },
            }),
        p: 0.5,
        borderRadius: 3,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: violation ? 'error.main' : 'divider',
        boxShadow: inline ? 'none' : theme.shadows[8],
      })}
    >
      <Box sx={{ position: 'relative', borderRadius: 2.5, overflow: 'hidden', bgcolor: 'grey.900', aspectRatio: '4 / 3' }}>
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          aria-label="Your camera preview"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transform: 'scaleX(-1)' }}
        />
        {violation && (
          <Box
            role="alert"
            sx={(theme) => ({
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              textAlign: 'center',
              p: 1,
              color: 'common.white',
              bgcolor: alpha(theme.palette.error.dark, 0.82),
            })}
          >
            <Box>
              <VideocamOffRoundedIcon fontSize={inline ? 'large' : 'small'} />
              <Typography variant="caption" component="p" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                Camera unavailable
              </Typography>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default memo(ProctoringWebcam);
