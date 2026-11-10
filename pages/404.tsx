import React from 'react';
import Link from 'next/link';

export default function NotFound404() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>404 - Page Not Found</h2>
      <p style={{ color: '#64748b', marginBottom: '1rem' }}>Could not find requested resource</p>
      <Link
        href="/"
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: '#7a1c7d',
          color: '#ffffff',
          borderRadius: '0.5rem',
          fontWeight: 600,
          textDecoration: 'none',
        }}
      >
        Return Home
      </Link>
    </div>
  );
}
