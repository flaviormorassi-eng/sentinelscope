
import React from 'react';

interface Step {
  targetId: string;
  title: string;
  content: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

interface OnboardingTourProps {
  steps: Step[];
  currentStep: number;
  onNext: () => void;
  onSkip: () => void;
  isActive: boolean;
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  background: 'rgba(0,0,0,0.3)',
  zIndex: 9999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 8,
  padding: 24,
  minWidth: 320,
  boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
  zIndex: 10000,
};

export default function OnboardingTour({ steps, currentStep, onNext, onSkip, isActive }: OnboardingTourProps) {
  if (!isActive || !steps[currentStep]) return null;
  const step = steps[currentStep];
  return (
    <div style={overlayStyle}>
      <div style={cardStyle}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{step.title}</h2>
        <p style={{ marginBottom: 16 }}>{step.content}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onSkip} style={{ background: '#eee', border: 'none', padding: '8px 16px', borderRadius: 4, cursor: 'pointer' }}>Skip</button>
          <button onClick={onNext} style={{ background: '#0070f3', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 4, cursor: 'pointer' }}>Next</button>
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: '#888' }}>
          Step {currentStep + 1} of {steps.length}
        </div>
      </div>
    </div>
  );
}
