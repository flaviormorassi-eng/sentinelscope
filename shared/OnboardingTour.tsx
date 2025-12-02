import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ArrowRight, X } from 'lucide-react';

interface TourStep {
  targetId: string;
  title: string;
  content: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

interface OnboardingTourProps {
  steps: TourStep[];
  currentStep: number;
  onNext: () => void;
  onSkip: () => void;
  isActive: boolean;
}

export function OnboardingTour({ steps, currentStep, onNext, onSkip, isActive }: OnboardingTourProps) {
  const { t } = useTranslation();

  if (!isActive || currentStep >= steps.length) {
    return null;
  }

  const step = steps[currentStep];
  const targetElement = document.getElementById(step.targetId);

  if (!targetElement) {
    return null;
  }

  const rect = targetElement.getBoundingClientRect();

  const getPositionStyles = () => {
    switch (step.position) {
      case 'bottom':
        return { top: `${rect.bottom + 10}px`, left: `${rect.left}px` };
      case 'top':
        return { bottom: `${window.innerHeight - rect.top + 10}px`, left: `${rect.left}px` };
      case 'right':
        return { top: `${rect.top}px`, left: `${rect.right + 10}px` };
      case 'left':
        return { top: `${rect.top}px`, right: `${window.innerWidth - rect.left + 10}px` };
      default:
        return {};
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-[9998]" onClick={onSkip} />

      {/* Highlight */}
      <div
        className="fixed z-[9999] border-2 border-primary rounded-lg shadow-lg pointer-events-none transition-all duration-300"
        style={{
          top: `${rect.top - 4}px`,
          left: `${rect.left - 4}px`,
          width: `${rect.width + 8}px`,
          height: `${rect.height + 8}px`,
        }}
      />

      {/* Popup */}
      <div
        className="fixed z-[10000] bg-background p-4 rounded-lg shadow-xl w-72"
        style={getPositionStyles()}
      >
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-bold text-lg">{t(step.title)}</h3>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onSkip}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">{t(step.content)}</p>
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">
            {currentStep + 1} / {steps.length}
          </span>
          <Button size="sm" onClick={onNext}>
            {currentStep === steps.length - 1 ? t('common.confirm') : t('common.next')}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    </>
  );
}