'use client';

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Clock, QrCode, ShoppingCart, Users } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";

function TimelineLanding() {
  const [activeStep, setActiveStep] = useState(0);
  const timelineRef = useRef<HTMLElement | null>(null);

  const steps = [
    {
      id: 0,
      title: "Browse Menu",
      description: "Explore our delicious menu with fresh items updated daily. See detailed descriptions, prices, and customer ratings.",
      icon: ShoppingCart,
      bgClass: 'bg-gradient-to-b from-orange-50 via-white to-blue-50',
      accentBg: 'bg-orange-600',
      accentText: 'text-orange-600',
      accentLightBg: 'bg-orange-100',
      borderAccent: 'border-orange-500'
    },
    {
      id: 1,
      title: "Select & Customize",
      description: "Choose your favorite items, customize them to your preference, and add them to your cart instantly.",
      icon: ShoppingCart,
      bgClass: 'bg-gradient-to-b from-red-50 via-white to-orange-50',
      accentBg: 'bg-red-600',
      accentText: 'text-red-600',
      accentLightBg: 'bg-red-100',
      borderAccent: 'border-red-500'
    },
    {
      id: 2,
      title: "Choose Pickup Time",
      description: "Select your preferred pickup time slot from available options. We prepare your order at the perfect time.",
      icon: Clock,
      bgClass: 'bg-gradient-to-b from-blue-50 via-white to-purple-50',
      accentBg: 'bg-blue-600',
      accentText: 'text-blue-600',
      accentLightBg: 'bg-blue-100',
      borderAccent: 'border-blue-500'
    },
    {
      id: 3,
      title: "Get QR Code",
      description: "Receive your unique QR code via SMS/email. This is your pickup verification - no confusion, just efficiency.",
      icon: QrCode,
      bgClass: 'bg-gradient-to-b from-purple-50 via-white to-pink-50',
      accentBg: 'bg-purple-600',
      accentText: 'text-purple-600',
      accentLightBg: 'bg-purple-100',
      borderAccent: 'border-purple-500'
    },
    {
      id: 4,
      title: "Pick Up Order",
      description: "Come at your chosen time, show your QR code to staff, and collect your fresh meal. Done!",
      icon: ShoppingCart,
      bgClass: 'bg-gradient-to-b from-green-50 via-white to-blue-50',
      accentBg: 'bg-green-600',
      accentText: 'text-green-600',
      accentLightBg: 'bg-green-100',
      borderAccent: 'border-green-500'
    }
  ];


  const currentStep = steps[activeStep];

  return (
    <main className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/image.png" alt="Kings Canteen" width={40} height={40} className="h-10 w-auto" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-500 via-red-500 to-blue-600 bg-clip-text text-transparent">
              Kings Canteen
            </h1>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button className="text-gray-700 bg-white hover:bg-gray-100 border border-gray-200">
                Sign In
              </Button>
            </Link>
            <Link href="/register">
              <Button className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-7xl mx-auto px-4 py-20 md:py-32">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                Order Fresh. Pick Up Fast.
              </h2>
              <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                Skip the line. Order your favorite meals from Kings Canteen, get a QR code, and pick up at your convenience. Fast, simple, and delicious.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/register">
                  <Button size="lg" className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white text-base">
                    Order Now
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="lg" variant="outline" className="border-gray-300 text-gray-700 hover:bg-gray-50 text-base">
                    Sign In
                  </Button>
                </Link>
              </div>
            </div>
            <div className="hidden md:flex justify-center">
              <Image 
                src="/image.png" 
                alt="Kings Canteen Logo" 
                width={400} 
                height={400} 
                className="w-72 h-auto"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Timeline Section */}
      <section
        ref={timelineRef}
        className={`transition-all duration-500 py-20 ${currentStep.bgClass}`}
      >
        <div className="max-w-7xl mx-auto px-4">
          <h3 className="text-4xl font-bold text-center text-gray-900 mb-20">How It Works</h3>
          
          <div className="grid md:grid-cols-2 gap-12">
            {/* Timeline */}
            <div className="relative">
              {/* Vertical Line */}
              <div className="absolute left-1/2 transform -translate-x-1/2 w-1 h-full bg-gradient-to-b from-orange-500 via-red-500 to-blue-600"></div>

              {/* Timeline Steps */}
              <div className="space-y-12">
                {steps.map((step, idx) => {
                  const StepIcon = step.icon;
                  const isActive = activeStep === idx;
                  
                  return (
                    <button
                      key={step.id}
                      type="button"
                      data-step={idx}
                      className="relative group w-full text-left cursor-pointer"
                      onMouseEnter={() => setActiveStep(idx)}
                      onClick={() => setActiveStep(idx)}
                      aria-pressed={isActive}
                    >
                      <div className="flex gap-6 md:gap-8 items-start">
                        <div className="hidden md:block w-5/12"></div>
                        <div className="relative z-10 flex flex-col items-center">
                          <div className={`transition-all duration-300 ${isActive ? 'scale-125' : 'group-hover:scale-110'}`}>
                            <div className={`w-16 h-16 rounded-full ${step.accentLightBg} bg-opacity-40 border-4 border-white shadow-lg flex items-center justify-center`}>
                              <div className={`w-12 h-12 rounded-full ${step.accentBg} flex items-center justify-center shadow-md`}>
                                <StepIcon className="w-6 h-6 text-white" />
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="w-5/12 flex items-center">
                          <div className="text-sm font-semibold text-gray-500 text-center w-full">
                            Step {step.id + 1}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active Step Detail */}
            <div className="relative flex items-center">
              <div className="w-full">
                <div
                  className={`bg-white p-8 md:p-12 rounded-2xl shadow-xl border-l-4 ${currentStep.borderAccent} sticky top-32 transition-all duration-300`}
                >
                  <div className="mb-6">
                    <div className={`inline-block p-4 rounded-lg ${currentStep.accentLightBg}`}>
                      {(() => {
                        const Icon = currentStep.icon;
                        return <Icon className={`w-8 h-8 ${currentStep.accentText}`} />;
                      })()}
                    </div>
                  </div>

                  <h4 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                    {currentStep.title}
                  </h4>

                  <p className="text-lg text-gray-600 leading-relaxed mb-8">
                    {currentStep.description}
                  </p>

                  <div className="pt-6 border-t border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-gray-600">Progress</span>
                      <span className={`text-sm font-bold ${currentStep.accentText}`}>
                        {currentStep.id + 1} of {steps.length}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`${currentStep.accentBg} h-2 rounded-full transition-all duration-500`}
                        style={{ width: `${((currentStep.id + 1) / steps.length) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Staff Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 rounded-2xl shadow-lg p-12 md:p-16 text-white">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <Users className="h-8 w-8" />
                  <h3 className="text-2xl font-bold">For Our Staff</h3>
                </div>
                <p className="text-lg opacity-90 mb-8">
                  Streamline your operations with our intelligent queue management system.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-center gap-3">
                    <div className="h-2 w-2 bg-white rounded-full" />
                    <span>Real-time order queue</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="h-2 w-2 bg-white rounded-full" />
                    <span>QR code scanning</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="h-2 w-2 bg-white rounded-full" />
                    <span>Order status tracking</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="h-2 w-2 bg-white rounded-full" />
                    <span>Menu management</span>
                  </li>
                </ul>
              </div>
              <div className="bg-white/10 backdrop-blur-sm p-8 rounded-xl">
                <p className="text-sm opacity-90 mb-6">Staff Login</p>
                <Link href="/staff/login">
                  <Button size="lg" className="w-full bg-white text-blue-600 hover:bg-gray-100 font-semibold">
                    Staff Portal
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Image src="/image.png" alt="Kings Canteen" width={32} height={32} />
                <h4 className="font-bold text-lg">Kings Canteen</h4>
              </div>
              <p className="text-gray-400 text-sm">Fast, Fresh, Delicious.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="/login" className="hover:text-white transition">Sign In</Link></li>
                <li><Link href="/register" className="hover:text-white transition">Register</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white transition">Contact Us</a></li>
                <li><a href="#" className="hover:text-white transition">FAQ</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-700 pt-8 text-center text-gray-400 text-sm">
            <p>© 2026 Kings Canteen. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}

export default TimelineLanding;
  