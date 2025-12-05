import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Scale, Ruler, Calculator, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { BMIData } from '@/hooks/useLeadTemperature';

interface BMICalculatorProps {
  onCalculate: (weight: number, height: number) => BMIData;
  bmiData?: BMIData;
}

const BMI_CATEGORIES = {
  underweight: {
    label: 'Underweight',
    color: 'bg-blue-500',
    textColor: 'text-blue-600',
    icon: TrendingDown,
    healthRisk: 'low',
  },
  normal: {
    label: 'Normal Weight',
    color: 'bg-green-500',
    textColor: 'text-green-600',
    icon: Minus,
    healthRisk: 'minimal',
  },
  overweight: {
    label: 'Overweight',
    color: 'bg-yellow-500',
    textColor: 'text-yellow-600',
    icon: TrendingUp,
    healthRisk: 'moderate',
  },
  obese: {
    label: 'Obese',
    color: 'bg-red-500',
    textColor: 'text-red-600',
    icon: TrendingUp,
    healthRisk: 'high',
  },
};

export const BMICalculator = ({ onCalculate, bmiData }: BMICalculatorProps) => {
  const [weight, setWeight] = useState<number>(75);
  const [height, setHeight] = useState<number>(170);
  const [unit, setUnit] = useState<'metric' | 'imperial'>('metric');

  const handleCalculate = () => {
    const result = onCalculate(weight, height);
    console.log('BMI Calculated:', result);
  };

  const category = bmiData ? BMI_CATEGORIES[bmiData.category] : null;
  const CategoryIcon = category?.icon;

  const getBMIColor = (bmi: number) => {
    if (bmi < 18.5) return 'text-blue-600';
    if (bmi < 25) return 'text-green-600';
    if (bmi < 30) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Card className="w-full shadow-lg border-2 border-primary/20">
      <CardHeader className="bg-gradient-to-r from-primary/10 to-secondary/10">
        <CardTitle className="flex items-center gap-2">
          <Calculator className="w-6 h-6 text-primary" />
          BMI Calculator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        {/* Weight Input */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2 text-base">
              <Scale className="w-4 h-4" />
              Weight ({unit === 'metric' ? 'kg' : 'lbs'})
            </Label>
            <span className="font-bold text-lg text-primary">{weight}</span>
          </div>
          <Slider
            value={[weight]}
            onValueChange={(v) => setWeight(v[0])}
            min={unit === 'metric' ? 40 : 88}
            max={unit === 'metric' ? 200 : 440}
            step={1}
            className="w-full"
          />
          <Input
            type="number"
            value={weight}
            onChange={(e) => setWeight(Number(e.target.value))}
            className="text-center text-lg font-semibold"
          />
        </div>

        {/* Height Input */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2 text-base">
              <Ruler className="w-4 h-4" />
              Height ({unit === 'metric' ? 'cm' : 'inches'})
            </Label>
            <span className="font-bold text-lg text-primary">{height}</span>
          </div>
          <Slider
            value={[height]}
            onValueChange={(v) => setHeight(v[0])}
            min={unit === 'metric' ? 140 : 55}
            max={unit === 'metric' ? 220 : 87}
            step={1}
            className="w-full"
          />
          <Input
            type="number"
            value={height}
            onChange={(e) => setHeight(Number(e.target.value))}
            className="text-center text-lg font-semibold"
          />
        </div>

        {/* Calculate Button */}
        <Button
          onClick={handleCalculate}
          className="w-full h-12 text-lg font-semibold"
          size="lg"
        >
          <Calculator className="w-5 h-5 mr-2" />
          Calculate BMI
        </Button>

        {/* Results */}
        {bmiData && category && (
          <div className="space-y-4 p-6 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-lg border-2 border-primary/30">
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground uppercase tracking-wide">
                Your BMI
              </p>
              <div className={`text-6xl font-black ${getBMIColor(bmiData.bmi)}`}>
                {bmiData.bmi.toFixed(1)}
              </div>
            </div>

            <div className="flex items-center justify-center gap-3">
              {CategoryIcon && (
                <CategoryIcon className={`w-6 h-6 ${category.textColor}`} />
              )}
              <Badge
                className={`${category.color} text-white px-4 py-2 text-base font-semibold`}
              >
                {category.label}
              </Badge>
            </div>

            <div className="pt-4 border-t border-gray-300 dark:border-gray-700 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Health Risk:</span>
                <span className={`font-semibold ${category.textColor} capitalize`}>
                  {category.healthRisk}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Weight:</span>
                <span className="font-semibold">{bmiData.weight} kg</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Height:</span>
                <span className="font-semibold">{bmiData.height} cm</span>
              </div>
            </div>

            {/* Health Message */}
            <div className="pt-4 text-center">
              {bmiData.category === 'normal' && (
                <p className="text-sm text-green-700 dark:text-green-400 font-medium">
                  🎉 Great! You're in the healthy weight range. Let's help you maintain it!
                </p>
              )}
              {bmiData.category === 'overweight' && (
                <p className="text-sm text-yellow-700 dark:text-yellow-400 font-medium">
                  💪 You're slightly above the healthy range. A personalized plan can help!
                </p>
              )}
              {bmiData.category === 'obese' && (
                <p className="text-sm text-red-700 dark:text-red-400 font-medium">
                  🚨 Health risks are elevated. Let's create a transformation plan together!
                </p>
              )}
              {bmiData.category === 'underweight' && (
                <p className="text-sm text-blue-700 dark:text-blue-400 font-medium">
                  📈 Let's build a plan to reach a healthier weight safely!
                </p>
              )}
            </div>
          </div>
        )}

        {/* BMI Reference Scale */}
        <div className="space-y-2 pt-4 border-t">
          <p className="text-sm font-semibold text-muted-foreground">BMI Reference Scale</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full" />
              <span>&lt; 18.5 Underweight</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full" />
              <span>18.5-24.9 Normal</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-full" />
              <span>25-29.9 Overweight</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full" />
              <span>≥ 30 Obese</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
