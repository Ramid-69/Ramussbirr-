'use client';

import React from 'react';

interface CBEAuthenticSpinnerProps {
  size?: number; // overall width/height in px
  color?: string; // petal color
  className?: string;
  speed?: number; // animation cycle duration in seconds
}

export default function CBEAuthenticSpinner({
  size = 44,
  color = '#8b278e',
  className = '',
  speed = 0.55,
}: CBEAuthenticSpinnerProps) {
  const petals = 8;
  const petalWidth = Math.max(3, Math.round(size * 0.085));
  const petalHeight = Math.round(size * 0.28);
  const radius = Math.round(size * 0.36);

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none pointer-events-none ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
      aria-label="Loading..."
      role="status"
    >
      {Array.from({ length: petals }).map((_, index) => {
        const angle = index * (360 / petals);
        const delay = -((petals - index) * (speed / petals));

        return (
          <span
            key={index}
            className="absolute origin-center block"
            style={{
              width: `${petalWidth}px`,
              height: `${petalHeight}px`,
              backgroundColor: color,
              borderRadius: '9999px',
              top: '50%',
              left: '50%',
              transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-${radius}px)`,
              animation: `cbePetalPulse ${speed}s linear infinite`,
              animationDelay: `${delay}s`,
            }}
          />
        );
      })}
    </div>
  );
}
