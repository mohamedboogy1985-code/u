import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Activity, Radio, Sparkles, Sliders } from 'lucide-react';
import { AppLanguage } from '../types';

interface WaveformVisualizerProps {
  analyser: AnalyserNode | null;
  isRecording: boolean;
  isMuted: boolean;
  audioLevel: number;
  recordingSeconds: number;
  appLang: AppLanguage;
}

export const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({
  analyser,
  isRecording,
  isMuted,
  audioLevel,
  recordingSeconds,
  appLang,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const [visualMode, setVisualMode] = useState<'wave' | 'bars' | 'aurora'>('aurora');

  const isArabic = appLang === 'ar';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let timeDomainBuffer: Uint8Array | null = null;
    let freqBuffer: Uint8Array | null = null;

    if (analyser) {
      analyser.fftSize = 512;
      const bufferLength = analyser.frequencyBinCount;
      timeDomainBuffer = new Uint8Array(bufferLength);
      freqBuffer = new Uint8Array(bufferLength);
    }

    let idleAngle = 0;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const centerY = height / 2;

      // Draw subtle background grid/centerline
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();

      // If muted or inactive, show idle state
      if (!isRecording || isMuted || !analyser || !timeDomainBuffer || !freqBuffer) {
        idleAngle += 0.03;

        if (isMuted && isRecording) {
          // Muted state: flat red line
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 6]);
          ctx.beginPath();
          ctx.moveTo(0, centerY);
          ctx.lineTo(width, centerY);
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          // Idle resting ambient wave
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(99, 102, 241, 0.35)';
          ctx.lineWidth = 2;

          const numPoints = 120;
          for (let i = 0; i <= numPoints; i++) {
            const x = (i / numPoints) * width;
            const wave1 = Math.sin(idleAngle + (i * 0.08)) * 5;
            const wave2 = Math.cos(idleAngle * 0.7 + (i * 0.05)) * 3;
            const y = centerY + wave1 + wave2;
            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }
          ctx.stroke();
        }

        ctx.restore();
        animationFrameIdRef.current = requestAnimationFrame(render);
        return;
      }

      // Live recording active with real AnalyserNode data
      analyser.getByteTimeDomainData(timeDomainBuffer);
      analyser.getByteFrequencyData(freqBuffer);

      const bufferLength = analyser.frequencyBinCount;

      if (visualMode === 'bars') {
        // Equalizer frequency bars radiating from center
        const barCount = 64;
        const barWidth = (width / barCount) * 0.65;
        const gap = (width / barCount) * 0.35;

        for (let i = 0; i < barCount; i++) {
          const freqIndex = Math.floor((i / barCount) * (bufferLength / 2));
          const freqVal = freqBuffer[freqIndex] || 0;
          const barHeight = Math.max(3, (freqVal / 255) * (height * 0.85));

          const x = i * (barWidth + gap);
          const y = centerY - barHeight / 2;

          // Gradient color from cyan to indigo to purple
          const grad = ctx.createLinearGradient(0, y, 0, y + barHeight);
          grad.addColorStop(0, '#38bdf8'); // Cyan
          grad.addColorStop(0.5, '#818cf8'); // Indigo
          grad.addColorStop(1, '#c084fc'); // Purple

          ctx.fillStyle = grad;
          ctx.beginPath();
          if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(x, y, barWidth, barHeight, 3);
          } else {
            ctx.rect(x, y, barWidth, barHeight);
          }
          ctx.fill();
        }
      } else if (visualMode === 'wave') {
        // High-precision smooth glowing oscilloscope waveform
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#38bdf8';
        ctx.shadowColor = 'rgba(56, 189, 248, 0.6)';
        ctx.shadowBlur = 8;

        ctx.beginPath();
        const sliceWidth = width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = timeDomainBuffer[i] / 128.0;
          const y = v * (height / 2);

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }

        ctx.stroke();
        ctx.shadowBlur = 0;
      } else {
        // 'aurora' mode: Combined mirrored fluid wave with frequency backdrop
        // 1. Frequency glow backdrop
        const barCount = 48;
        const barWidth = width / barCount;
        for (let i = 0; i < barCount; i++) {
          const freqIndex = Math.floor((i / barCount) * (bufferLength / 2.5));
          const freqVal = freqBuffer[freqIndex] || 0;
          const barHeight = (freqVal / 255) * (height * 0.6);

          if (barHeight > 4) {
            const grad = ctx.createLinearGradient(0, centerY - barHeight, 0, centerY + barHeight);
            grad.addColorStop(0, 'rgba(56, 189, 248, 0.08)');
            grad.addColorStop(0.5, 'rgba(99, 102, 241, 0.25)');
            grad.addColorStop(1, 'rgba(168, 85, 247, 0.08)');

            ctx.fillStyle = grad;
            ctx.fillRect(i * barWidth, centerY - barHeight, barWidth - 1, barHeight * 2);
          }
        }

        // 2. Main flowing time-domain waveform
        const gradStroke = ctx.createLinearGradient(0, 0, width, 0);
        gradStroke.addColorStop(0, '#38bdf8');
        gradStroke.addColorStop(0.3, '#818cf8');
        gradStroke.addColorStop(0.7, '#a855f7');
        gradStroke.addColorStop(1, '#34d399');

        ctx.strokeStyle = gradStroke;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = 'rgba(129, 140, 248, 0.8)';
        ctx.shadowBlur = 10;

        ctx.beginPath();
        const sliceWidth = width / bufferLength;
        let curX = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = timeDomainBuffer[i] / 128.0;
          const y = (v * (height / 2));

          if (i === 0) {
            ctx.moveTo(curX, y);
          } else {
            ctx.lineTo(curX, y);
          }
          curX += sliceWidth;
        }
        ctx.stroke();

        // 3. Secondary mirrored harmonic wave (delicate glow)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 1;
        ctx.shadowBlur = 4;
        ctx.beginPath();
        curX = 0;

        for (let i = 0; i < bufferLength; i += 2) {
          const v = timeDomainBuffer[i] / 128.0;
          const delta = (v - 1) * 0.5;
          const y = centerY - (delta * (height / 2));

          if (i === 0) {
            ctx.moveTo(curX, y);
          } else {
            ctx.lineTo(curX, y);
          }
          curX += sliceWidth * 2;
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      ctx.restore();
      animationFrameIdRef.current = requestAnimationFrame(render);
    };

    animationFrameIdRef.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [analyser, isRecording, isMuted, visualMode]);

  return (
    <div className="w-full shrink-0 border-b border-white/10 bg-gradient-to-b from-zinc-950 to-black px-4 sm:px-6 py-2">
      <div className="max-w-7xl mx-auto flex flex-col gap-1.5">
        {/* Top Waveform Header Row */}
        <div className="flex items-center justify-between text-xs text-white/60">
          <div className="flex items-center gap-2">
            <Activity className={`w-3.5 h-3.5 ${isRecording ? 'text-emerald-400 animate-pulse' : 'text-white/40'}`} />
            <span className="font-mono text-[11px] font-medium tracking-wide uppercase text-white/70">
              {isArabic ? 'موجة الصوت الحية (Realtime Audio Waveform)' : 'Live Waveform Visualizer'}
            </span>
            {isRecording && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-mono text-[10px]">
                16 kHz PCM &bull; 1 Ch
              </span>
            )}
            {isMuted && isRecording && (
              <span className="px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 font-mono text-[10px] flex items-center gap-1">
                <VolumeX className="w-3 h-3" />
                <span>{isArabic ? 'الميكروفون مكتوم' : 'Muted'}</span>
              </span>
            )}
          </div>

          {/* Mode Switcher & Level */}
          <div className="flex items-center gap-3">
            {/* Visualizer Mode selector */}
            <div className="flex items-center bg-white/5 border border-white/10 rounded-lg p-0.5 text-[10px] font-mono">
              <button
                onClick={() => setVisualMode('aurora')}
                className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                  visualMode === 'aurora' ? 'bg-indigo-600 text-white font-bold' : 'text-white/50 hover:text-white'
                }`}
                title="Aurora Wave"
              >
                {isArabic ? 'أورورا' : 'Aurora'}
              </button>
              <button
                onClick={() => setVisualMode('bars')}
                className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                  visualMode === 'bars' ? 'bg-indigo-600 text-white font-bold' : 'text-white/50 hover:text-white'
                }`}
                title="Equalizer Spectrum Bars"
              >
                {isArabic ? 'أعمدة' : 'Bars'}
              </button>
              <button
                onClick={() => setVisualMode('wave')}
                className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                  visualMode === 'wave' ? 'bg-indigo-600 text-white font-bold' : 'text-white/50 hover:text-white'
                }`}
                title="Oscilloscope"
              >
                {isArabic ? 'موجة' : 'Wave'}
              </button>
            </div>

            {/* Live dB/Volume Level */}
            <div className="hidden sm:flex items-center gap-1.5 font-mono text-[11px] text-white/50">
              <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>{Math.round(audioLevel * 100)}%</span>
            </div>
          </div>
        </div>

        {/* Canvas Display */}
        <div className="relative w-full h-14 sm:h-16 rounded-xl bg-black/60 border border-white/10 overflow-hidden shadow-inner flex items-center justify-center">
          <canvas
            ref={canvasRef}
            className="w-full h-full block"
          />

          {!isRecording && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <span className="text-[11px] font-mono text-white/30 bg-black/40 px-3 py-1 rounded-full border border-white/5 backdrop-blur-sm">
                {isArabic ? 'الميكروفون في وضع الاستعداد • اضغط على زر التسجيل للبدء' : 'Microphone Ready • Click Record to Start'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
