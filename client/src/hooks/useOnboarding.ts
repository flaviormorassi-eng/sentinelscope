
import { useState, useCallback } from 'react';

export function useOnboarding(totalSteps: number) {
  const [isTourActive, setIsTourActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const startTour = useCallback(() => {
    setCurrentStep(0);
    setIsTourActive(true);
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStep((step) => {
      if (step + 1 < totalSteps) {
        return step + 1;
      } else {
        setIsTourActive(false);
        return 0;
      }
    });
  }, [totalSteps]);

  const skipTour = useCallback(() => {
    setIsTourActive(false);
    setCurrentStep(0);
  }, []);

  return {
    currentStep,
    nextStep,
    skipTour,
    isTourActive,
    startTour,
  };
}
