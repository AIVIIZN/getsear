'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Calculator, TrendingUp } from 'lucide-react';
import { useScrollFadeIn } from './useScrollFadeIn';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Animated counter that rolls up from 0 to target value
 */
function useAnimatedValue(target: number, duration = 600): number {
  const [display, setDisplay] = useState(target);
  const animRef = useRef<number | null>(null);
  const startVal = useRef(target);
  const startTime = useRef(0);

  useEffect(() => {
    startVal.current = display;
    startTime.current = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime.current;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(
        startVal.current + (target - startVal.current) * eased
      );
      setDisplay(current);
      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      }
    };

    animRef.current = requestAnimationFrame(animate);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return display;
}

export function ROICalculator() {
  const { ref, isVisible } = useScrollFadeIn();

  const [cardVolume, setCardVolume] = useState(50000);
  const [processingRate, setProcessingRate] = useState(2.6);
  const [softwareCost, setSoftwareCost] = useState(250);
  const [hardwareLease, setHardwareLease] = useState(150);

  // Sear costs: $129/mo (Growth) + $0 processing (dual pricing)
  const searSoftwareCost = 129;
  const searProcessingCost = 0; // Dual pricing shifts cost to cardholder

  const currentMonthlyProcessing = (cardVolume * processingRate) / 100;
  const currentTotalMonthly =
    currentMonthlyProcessing + softwareCost + hardwareLease;

  // Sear: software + $0 processing (BYOD = no hardware lease)
  const searTotalMonthly = searSoftwareCost + searProcessingCost;

  const monthlySavings = Math.max(0, currentTotalMonthly - searTotalMonthly);
  const annualSavings = monthlySavings * 12;

  const animatedMonthly = useAnimatedValue(Math.round(monthlySavings));
  const animatedAnnual = useAnimatedValue(Math.round(annualSavings));

  const handleSliderChange = useCallback(
    (setter: (v: number) => void) =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setter(Number(e.target.value));
      },
    []
  );

  return (
    <section
      id="calculator"
      className="bg-white py-20 md:py-28"
      ref={ref}
    >
      <div
        className="mx-auto max-w-7xl px-6"
        style={{
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'translateY(0)' : 'translateY(24px)',
          transition: 'opacity 0.6s ease, transform 0.6s ease',
        }}
      >
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#FFF4EC] px-4 py-1.5">
            <Calculator size={16} className="text-[#007AFF]" />
            <span className="text-[13px] font-semibold text-[#9A4A12]">
              ROI Calculator
            </span>
          </div>
          <h2 className="text-[32px] font-bold tracking-tight text-[#1C1C1E] md:text-[40px]">
            How much will you save?
          </h2>
          <p className="mt-4 text-[18px] leading-relaxed text-[#78756D]">
            Enter your current costs. See your savings instantly.
          </p>
        </div>

        <div className="mt-16 grid gap-10 lg:grid-cols-2">
          {/* Inputs */}
          <div className="space-y-8 rounded-2xl border border-[rgba(60,60,67,0.08)] bg-[#FDFBF7] p-8">
            <h3 className="text-[18px] font-semibold text-[#1C1C1E]">
              Your current costs
            </h3>

            {/* Card Volume */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-[15px] font-medium text-[#3D3D37]">
                  Monthly card volume
                </label>
                <span className="text-[15px] font-semibold tabular-nums text-[#1C1C1E]">
                  {formatCurrency(cardVolume)}
                </span>
              </div>
              <input
                type="range"
                min={10000}
                max={200000}
                step={5000}
                value={cardVolume}
                onChange={handleSliderChange(setCardVolume)}
                className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-[#F0EDE8] accent-[#007AFF] [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#007AFF] [&::-webkit-slider-thumb]:shadow-md"
              />
              <div className="mt-1 flex justify-between text-[12px] text-[#78756D]">
                <span>$10K</span>
                <span>$200K</span>
              </div>
            </div>

            {/* Processing Rate */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-[15px] font-medium text-[#3D3D37]">
                  Current processing rate
                </label>
                <span className="text-[15px] font-semibold tabular-nums text-[#1C1C1E]">
                  {processingRate.toFixed(1)}%
                </span>
              </div>
              <input
                type="range"
                min={1.5}
                max={4.0}
                step={0.1}
                value={processingRate}
                onChange={handleSliderChange(setProcessingRate)}
                className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-[#F0EDE8] accent-[#007AFF] [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#007AFF] [&::-webkit-slider-thumb]:shadow-md"
              />
              <div className="mt-1 flex justify-between text-[12px] text-[#78756D]">
                <span>1.5%</span>
                <span>4.0%</span>
              </div>
            </div>

            {/* Software Cost */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-[15px] font-medium text-[#3D3D37]">
                  Monthly software cost
                </label>
                <span className="text-[15px] font-semibold tabular-nums text-[#1C1C1E]">
                  {formatCurrency(softwareCost)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={800}
                step={25}
                value={softwareCost}
                onChange={handleSliderChange(setSoftwareCost)}
                className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-[#F0EDE8] accent-[#007AFF] [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#007AFF] [&::-webkit-slider-thumb]:shadow-md"
              />
              <div className="mt-1 flex justify-between text-[12px] text-[#78756D]">
                <span>$0</span>
                <span>$800</span>
              </div>
            </div>

            {/* Hardware Lease */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-[15px] font-medium text-[#3D3D37]">
                  Monthly hardware lease
                </label>
                <span className="text-[15px] font-semibold tabular-nums text-[#1C1C1E]">
                  {formatCurrency(hardwareLease)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={500}
                step={25}
                value={hardwareLease}
                onChange={handleSliderChange(setHardwareLease)}
                className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-[#F0EDE8] accent-[#007AFF] [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#007AFF] [&::-webkit-slider-thumb]:shadow-md"
              />
              <div className="mt-1 flex justify-between text-[12px] text-[#78756D]">
                <span>$0</span>
                <span>$500</span>
              </div>
            </div>
          </div>

          {/* Output */}
          <div className="flex flex-col justify-between">
            {/* Savings card */}
            <div className="rounded-2xl bg-gradient-to-br from-[#1C1C1E] to-[#2C2C2E] p-8 text-white">
              <div className="flex items-center gap-2">
                <TrendingUp size={20} className="text-[#34C759]" />
                <span className="text-[15px] font-medium text-[#A1A1A6]">
                  Your estimated savings with Sear
                </span>
              </div>

              <div className="mt-6">
                <span className="text-[56px] font-bold tracking-tight tabular-nums text-[#007AFF] md:text-[64px]">
                  {formatCurrency(animatedMonthly)}
                </span>
                <span className="ml-2 text-[18px] text-[#A1A1A6]">
                  per month
                </span>
              </div>

              <div className="mt-2">
                <span className="text-[28px] font-bold tabular-nums text-white">
                  {formatCurrency(animatedAnnual)}
                </span>
                <span className="ml-2 text-[15px] text-[#A1A1A6]">
                  per year
                </span>
              </div>

              <div className="mt-8 space-y-3 border-t border-white/10 pt-6">
                <h4 className="text-[14px] font-medium text-[#A1A1A6]">
                  Savings breakdown
                </h4>
                <div className="flex justify-between">
                  <span className="text-[14px] text-[#A1A1A6]">
                    Processing fee savings (dual pricing)
                  </span>
                  <span className="text-[14px] font-semibold tabular-nums text-[#34C759]">
                    +{formatCurrency(currentMonthlyProcessing)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[14px] text-[#A1A1A6]">
                    Software cost difference
                  </span>
                  <span className="text-[14px] font-semibold tabular-nums text-[#34C759]">
                    +{formatCurrency(Math.max(0, softwareCost - searSoftwareCost))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[14px] text-[#A1A1A6]">
                    Hardware lease eliminated
                  </span>
                  <span className="text-[14px] font-semibold tabular-nums text-[#34C759]">
                    +{formatCurrency(hardwareLease)}
                  </span>
                </div>
              </div>
            </div>

            {/* What you'll pay */}
            <div className="mt-6 rounded-2xl border border-[rgba(60,60,67,0.08)] bg-white p-6">
              <h4 className="text-[15px] font-semibold text-[#1C1C1E]">
                With Sear, you pay:
              </h4>
              <div className="mt-3 space-y-2">
                <div className="flex justify-between text-[14px]">
                  <span className="text-[#78756D]">
                    Software (Growth plan)
                  </span>
                  <span className="font-medium text-[#1C1C1E]">
                    $129/mo
                  </span>
                </div>
                <div className="flex justify-between text-[14px]">
                  <span className="text-[#78756D]">
                    Processing fees (dual pricing)
                  </span>
                  <span className="font-medium text-[#34C759]">$0/mo*</span>
                </div>
                <div className="flex justify-between text-[14px]">
                  <span className="text-[#78756D]">
                    Hardware (BYOD iPad)
                  </span>
                  <span className="font-medium text-[#1C1C1E]">
                    $329 one-time
                  </span>
                </div>
              </div>
              <p className="mt-4 text-[12px] text-[#78756D]">
                * Processing fees shifted to cardholder via Valor Dual Pricing.
                Actual rates per Valor merchant agreement.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
