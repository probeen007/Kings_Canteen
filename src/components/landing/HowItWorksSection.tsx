import { Clock, QrCode, ShoppingCart } from "lucide-react";
import { useRef, useState } from "react";

const steps = [
  {
    id: 0,
    title: "Browse Menu",
    description:
      "Explore our delicious menu with fresh items updated daily. See detailed descriptions, prices, and customer ratings.",
    icon: ShoppingCart,
    bgClass: "bg-gradient-to-b from-orange-50 via-white to-blue-50",
    accentBg: "bg-orange-600",
    accentText: "text-orange-600",
    accentLightBg: "bg-orange-100",
    borderAccent: "border-orange-500",
  },
  {
    id: 1,
    title: "Select & Customize",
    description: "Choose your favorite items, customize them to your preference, and add them to your cart instantly.",
    icon: ShoppingCart,
    bgClass: "bg-gradient-to-b from-red-50 via-white to-orange-50",
    accentBg: "bg-red-600",
    accentText: "text-red-600",
    accentLightBg: "bg-red-100",
    borderAccent: "border-red-500",
  },
  {
    id: 2,
    title: "Choose Pickup Time",
    description:
      "Select your preferred pickup time slot from available options. We prepare your order at the perfect time.",
    icon: Clock,
    bgClass: "bg-gradient-to-b from-blue-50 via-white to-purple-50",
    accentBg: "bg-blue-600",
    accentText: "text-blue-600",
    accentLightBg: "bg-blue-100",
    borderAccent: "border-blue-500",
  },
  {
    id: 3,
    title: "Get QR Code",
    description: "Receive your unique QR code via SMS/email. This is your pickup verification - no confusion, just efficiency.",
    icon: QrCode,
    bgClass: "bg-gradient-to-b from-purple-50 via-white to-pink-50",
    accentBg: "bg-purple-600",
    accentText: "text-purple-600",
    accentLightBg: "bg-purple-100",
    borderAccent: "border-purple-500",
  },
  {
    id: 4,
    title: "Pick Up Order",
    description: "Come at your chosen time, show your QR code to staff, and collect your fresh meal. Done!",
    icon: ShoppingCart,
    bgClass: "bg-gradient-to-b from-green-50 via-white to-blue-50",
    accentBg: "bg-green-600",
    accentText: "text-green-600",
    accentLightBg: "bg-green-100",
    borderAccent: "border-green-500",
  },
];

export function HowItWorksSection() {
  const [activeStep, setActiveStep] = useState(0);
  const timelineRef = useRef<HTMLElement | null>(null);
  const currentStep = steps[activeStep];

  return (
    <section ref={timelineRef} className={`py-20 transition-all duration-500 ${currentStep.bgClass}`}>
      <div className="mx-auto max-w-7xl px-4">
        <h3 className="mb-8 text-center text-2xl font-bold text-gray-900 sm:mb-12 sm:text-3xl md:mb-16 md:text-4xl">
          How It Works
        </h3>

        <div className="space-y-6 md:hidden">
          {steps.map((step) => {
            const StepIcon = step.icon;
            return (
              <div key={step.id} className="rounded-2xl border border-white/60 bg-white/90 p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-full ${step.accentLightBg}`}>
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full ${step.accentBg}`}>
                      <StepIcon className="h-4 w-4 text-white" />
                    </div>
                  </div>
                  <div>
                    <p className={`text-xs font-semibold uppercase tracking-wide ${step.accentText}`}>
                      Step {step.id + 1}
                    </p>
                    <h4 className="text-base font-semibold text-gray-900">{step.title}</h4>
                  </div>
                </div>
                <p className="mt-3 text-[13px] leading-relaxed text-gray-600">{step.description}</p>
              </div>
            );
          })}
        </div>

        <div className="hidden md:grid md:grid-cols-2 gap-12">
          <div className="relative">
            <div className="absolute left-1/2 h-full w-1 -translate-x-1/2 transform bg-gradient-to-b from-orange-500 via-red-500 to-blue-600" />

            <div className="space-y-12">
              {steps.map((step, idx) => {
                const StepIcon = step.icon;
                const isActive = activeStep === idx;

                return (
                  <button
                    key={step.id}
                    type="button"
                    data-step={idx}
                    className="group relative w-full cursor-pointer text-left"
                    onMouseEnter={() => setActiveStep(idx)}
                    onClick={() => setActiveStep(idx)}
                    aria-pressed={isActive}
                  >
                    <div className="flex items-start gap-6 md:gap-8">
                      <div className="hidden w-5/12 md:block" />
                      <div className="relative z-10 flex flex-col items-center">
                        <div
                          className={`transition-all duration-300 ${
                            isActive ? "scale-125" : "group-hover:scale-110"
                          }`}
                        >
                          <div
                            className={`flex h-16 w-16 items-center justify-center rounded-full border-4 border-white ${step.accentLightBg} bg-opacity-40 shadow-lg`}
                          >
                            <div className={`flex h-12 w-12 items-center justify-center rounded-full ${step.accentBg} shadow-md`}>
                              <StepIcon className="h-6 w-6 text-white" />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex w-5/12 items-center">
                        <div className="w-full text-center text-sm font-semibold text-gray-500">Step {step.id + 1}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="relative flex items-center">
            <div className="w-full">
              <div
                className={`sticky top-32 rounded-2xl border-l-4 bg-white p-8 shadow-xl transition-all duration-300 md:p-12 ${currentStep.borderAccent}`}
              >
                <div className="mb-6">
                  <div className={`inline-block rounded-lg p-4 ${currentStep.accentLightBg}`}>
                    {(() => {
                      const Icon = currentStep.icon;
                      return <Icon className={`h-8 w-8 ${currentStep.accentText}`} />;
                    })()}
                  </div>
                </div>

                <h4 className="mb-3 text-2xl font-bold text-gray-900 md:text-3xl">{currentStep.title}</h4>

                <p className="mb-6 text-base leading-relaxed text-gray-600">{currentStep.description}</p>

                <div className="border-t border-gray-200 pt-6">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-600">Progress</span>
                    <span className={`text-sm font-bold ${currentStep.accentText}`}>
                      {currentStep.id + 1} of {steps.length}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-200">
                    <div
                      className={`${currentStep.accentBg} h-2 rounded-full transition-all duration-500`}
                      style={{ width: `${((currentStep.id + 1) / steps.length) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
