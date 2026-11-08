'use client';

import React from 'react';

interface CBEAuthenticSpinnerProps {
  size?: number; // overall width/height in px
  color?: string; // dot color (brand purple #8b278e)
  className?: string;
  speed?: number; // animation cycle duration in seconds
  dotCount?: number; // authentic 8 dots in CBEBirr
}

export default function CBEAuthenticSpinner({
  size = 38,
  color = '#8b278e',
  className = '',
  speed = 0.85,
  dotCount = 8,
}: CBEAuthenticSpinnerProps) {
  // Dot diameter proportional to spinner size (matches CBEBirr authentic dot chaser)
  const dotDiameter = Math.max(4, Math.round(size * 0.19));
  const radius = Math.round(size * 0.36);

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none pointer-events-none ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
      aria-label="Loading..."
      role="status"
    >
      {Array.from({ length: dotCount }).map((_, index) => {
        const angle = index * (360 / dotCount);
        // Staggered negative delay so dots light up and turn off sequentially clockwise
        const delay = -((dotCount - index) * (speed / dotCount));

        return (
          <div
            key={index}
            className="absolute origin-center flex items-center justify-center pointer-events-none select-none"
            style={{
              width: `${dotDiameter}px`,
              height: `${dotDiameter}px`,
              top: '50%',
              left: '50%',
              transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-${radius}px)`,
            }}
          >
            <span
              className="block w-full h-full rounded-full"
              style={{
                backgroundColor: color,
                animation: `cbeDotChaser ${speed}s linear infinite`,
                animationDelay: `${delay}s`,
                willChange: 'opacity, transform',
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
