import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export const useOnboarding = (totalSteps: number) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isTourActive, setIsTourActive] = useState(false);
  const queryClient = useQueryClient();

  const completeTourMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('PUT', '/api/user/preferences', { tourCompleted: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/preferences'] });
    },
  });

  const nextStep = useCallback(() => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setIsTourActive(false);
      completeTourMutation.mutate();
    }
  }, [currentStep, totalSteps, completeTourMutation]);

  const skipTour = useCallback(() => {
    setIsTourActive(false);
    completeTourMutation.mutate();
  }, [completeTourMutation]);

  const startTour = () => {
    setCurrentStep(0);
    setIsTourActive(true);
  };

  return { currentStep, nextStep, skipTour, isTourActive, startTour };
};