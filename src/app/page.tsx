"use client";

import { HeroSection } from "@/components/landing/HeroSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingNav } from "@/components/landing/LandingNav";
import { StaffSection } from "@/components/landing/StaffSection";

export default function TimelineLanding() {
  return (
    <main className="min-h-screen bg-white">
      <LandingNav />
      <HeroSection />
      <HowItWorksSection />
      <StaffSection />
      <LandingFooter />
    </main>
  );
}
  