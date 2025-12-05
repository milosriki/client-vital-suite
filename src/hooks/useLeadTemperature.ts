/**
 * Lead Temperature Scoring Hook
 *
 * Calculates lead "temperature" (hot/warm/cold) based on:
 * - BMI category and health urgency
 * - Engagement level
 * - Budget signals
 * - Urgency indicators
 */

import { useState, useCallback } from 'react';

export type LeadTemperature = 'hot' | 'warm' | 'cold';

export interface BMIData {
  weight: number; // kg
  height: number; // cm
  bmi: number;
  category: 'underweight' | 'normal' | 'overweight' | 'obese';
}

export interface LeadScoreFactors {
  bmiCategory: BMIData['category'];
  engagementLevel: 'high' | 'medium' | 'low';
  budgetSignals: 'high' | 'medium' | 'low';
  urgency: 'immediate' | 'high' | 'medium' | 'low';
}

export const useLeadTemperature = () => {
  const [engagementScore, setEngagementScore] = useState(0);

  /**
   * Calculate BMI from weight and height
   */
  const calculateBMI = useCallback((weight: number, height: number): BMIData => {
    const bmi = weight / Math.pow(height / 100, 2);

    let category: BMIData['category'];
    if (bmi < 18.5) category = 'underweight';
    else if (bmi < 25) category = 'normal';
    else if (bmi < 30) category = 'overweight';
    else category = 'obese';

    return { weight, height, bmi, category };
  }, []);

  /**
   * Calculate lead score (0-100)
   */
  const calculateLeadScore = useCallback(
    (factors: LeadScoreFactors): number => {
      let score = 0;

      // BMI Category Score (max 30 points)
      // Higher urgency = higher score
      const bmiScores = {
        obese: 30, // High health risk = urgent need
        overweight: 20,
        underweight: 15,
        normal: 10, // Still interested in fitness
      };
      score += bmiScores[factors.bmiCategory];

      // Engagement Level (max 30 points)
      const engagementScores = {
        high: 30,
        medium: 20,
        low: 10,
      };
      score += engagementScores[factors.engagementLevel];

      // Budget Signals (max 20 points)
      const budgetScores = {
        high: 20,
        medium: 15,
        low: 10,
      };
      score += budgetScores[factors.budgetSignals];

      // Urgency (max 20 points)
      const urgencyScores = {
        immediate: 20,
        high: 15,
        medium: 10,
        low: 5,
      };
      score += urgencyScores[factors.urgency];

      return Math.min(100, score);
    },
    []
  );

  /**
   * Get lead temperature based on score
   */
  const getLeadTemperature = useCallback((score: number): LeadTemperature => {
    if (score >= 70) return 'hot';
    if (score >= 40) return 'warm';
    return 'cold';
  }, []);

  /**
   * Add engagement signal
   */
  const addEngagementSignal = useCallback((action: string, points: number) => {
    setEngagementScore((prev) => prev + points);
    console.log(`Engagement: ${action} (+${points} points)`);
  }, []);

  return {
    calculateBMI,
    calculateLeadScore,
    getLeadTemperature,
    addEngagementSignal,
    engagementScore,
  };
};
