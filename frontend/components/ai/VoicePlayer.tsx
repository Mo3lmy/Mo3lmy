"use client";

import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  SkipBack,
  SkipForward,
  Loader2
} from 'lucide-react';
import { motion } from 'framer-motion';

interface VoicePlayerProps {
  audioUrl: string;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  className?: string;
}

export default function VoicePlayer({
  audioUrl,
  isPlaying,
  onPlay,
  onPause,
  className = ''
}: VoicePlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Update audio element when URL changes
  useEffect(() => {
    if (audioRef.current && audioUrl) {
      audioRef.current.src = audioUrl;
      audioRef.current.load();
    }
  }, [audioUrl]);

  // Handle play/pause
  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(err => {
          console.error('Failed to play audio:', err);
          onPause();
        });
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, onPause]);

  // Handle volume changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      setIsLoading(false);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleSkip = (seconds: number) => {
    if (audioRef.current) {
      const newTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + seconds));
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`bg-gradient-to-br from-primary-50 to-primary-100 rounded-lg p-4 ${className}`}>
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={onPause}
        onLoadStart={() => setIsLoading(true)}
        onCanPlay={() => setIsLoading(false)}
      />

      {/* Main Controls */}
      <div className="flex items-center gap-3 mb-3">
        {/* Skip Back */}
        <button
          onClick={() => handleSkip(-10)}
          disabled={isLoading}
          className="p-2 hover:bg-white/50 rounded-lg transition-colors disabled:opacity-50"
          title="الرجوع 10 ثوانٍ"
        >
          <SkipBack className="h-4 w-4 text-primary-600" />
        </button>

        {/* Play/Pause Button */}
        <button
          onClick={isPlaying ? onPause : onPlay}
          disabled={isLoading}
          className="p-3 bg-white hover:bg-gray-50 rounded-full shadow-md
                     transition-all duration-200 transform hover:scale-105 active:scale-95
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <Loader2 className="h-6 w-6 text-primary-500 animate-spin" />
          ) : isPlaying ? (
            <Pause className="h-6 w-6 text-primary-600" />
          ) : (
            <Play className="h-6 w-6 text-primary-600 mr-0.5" />
          )}
        </button>

        {/* Skip Forward */}
        <button
          onClick={() => handleSkip(10)}
          disabled={isLoading}
          className="p-2 hover:bg-white/50 rounded-lg transition-colors disabled:opacity-50"
          title="التقدم 10 ثوانٍ"
        >
          <SkipForward className="h-4 w-4 text-primary-600" />
        </button>

        {/* Time Display */}
        <div className="flex-1 flex items-center gap-2 text-sm text-primary-700 font-medium">
          <span>{formatTime(currentTime)}</span>
          <span className="text-primary-400">/</span>
          <span>{formatTime(duration)}</span>
        </div>

        {/* Volume Control */}
        <button
          onClick={() => setIsMuted(!isMuted)}
          className="p-2 hover:bg-white/50 rounded-lg transition-colors"
        >
          {isMuted ? (
            <VolumeX className="h-4 w-4 text-primary-600" />
          ) : (
            <Volume2 className="h-4 w-4 text-primary-600" />
          )}
        </button>

        {/* Volume Slider */}
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={isMuted ? 0 : volume}
          onChange={(e) => {
            setVolume(parseFloat(e.target.value));
            setIsMuted(false);
          }}
          className="w-20 accent-primary-500"
        />
      </div>

      {/* Progress Bar */}
      <div className="relative">
        {/* Background Track */}
        <div className="h-2 bg-white/60 rounded-full overflow-hidden">
          {/* Progress Fill */}
          <motion.div
            className="h-full bg-gradient-to-r from-primary-400 to-primary-600"
            style={{ width: `${progress}%` }}
            transition={{ duration: 0.1 }}
          />
        </div>

        {/* Seek Slider (invisible overlay) */}
        <input
          type="range"
          min="0"
          max={duration || 100}
          value={currentTime}
          onChange={handleSeek}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
          disabled={isLoading}
        />
      </div>

      {/* Visual Waveform Animation */}
      {isPlaying && (
        <div className="flex items-center justify-center gap-1 mt-3">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="w-1 bg-primary-400 rounded-full"
              animate={{
                height: [8, 20, 8],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: i * 0.05,
                ease: "easeInOut"
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}