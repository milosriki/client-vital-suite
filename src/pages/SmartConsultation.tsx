/**
 * Smart Consultation Page
 */

import { useState } from 'react';
import { BMICalculator } from '@/components/smart-consultation/BMICalculator';
import { useLeadTemperature, BMIData } from '@/hooks/useLeadTemperature';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Brain, Target, Zap, Flame, ThermometerSun, Snowflake, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const SmartConsultation = () => {
  const { toast } = useToast();
  const { calculateBMI, calculateLeadScore, getLeadTemperature } = useLeadTemperature();
  const [bmiData, setBmiData] = useState<BMIData | undefined>();
  const [leadScore, setLeadScore] = useState<number>(0);
  const [leadTemperature, setLeadTemperature] = useState<'hot' | 'warm' | 'cold'>('cold');

  const handleBMICalculate = (weight: number, height: number) => {
    const result = calculateBMI(weight, height);
    setBmiData(result);
    const score = calculateLeadScore({
      bmiCategory: result.category,
      engagementLevel: 'high',
      budgetSignals: 'medium',
      urgency: 'high',
    });
    setLeadScore(score);
    setLeadTemperature(getLeadTemperature(score));
    toast({ title: 'BMI Calculated', description: `Your BMI is ${result.bmi.toFixed(1)} - ${result.category}` });
    return result;
  };

  return (
    <div className='min-h-screen bg-gradient-to-br from-primary/5'>
      <div className='container mx-auto px-4 py-8'>
        <div className='text-center space-y-4 mb-12'>
          <h1 className='text-4xl font-black'>Smart Consultation</h1>
        </div>
        <div className='grid lg:grid-cols-2 gap-8 max-w-7xl mx-auto'>
          <BMICalculator onCalculate={handleBMICalculate} bmiData={bmiData} />
        </div>
      </div>
    </div>
  );
};

export default SmartConsultation;
