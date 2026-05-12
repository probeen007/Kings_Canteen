import Link from "next/link";
import Image from "next/image";

import { Button } from "@/components/ui/button";

export function HeroSection() {
  return (
    <section className="bg-gradient-to-b from-blue-50 to-white">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:py-20 md:grid-cols-2 md:py-32">
        <div className="order-2 text-center md:order-1 md:text-left">
          <h2 className="text-[clamp(2rem,6vw,3.75rem)] font-bold leading-tight text-gray-900">
            Order Fresh. Pick Up Fast.
          </h2>
          <p className="mt-5 text-[clamp(1rem,2.6vw,1.125rem)] leading-relaxed text-gray-600">
            Skip the line. Order your favorite meals from Kings Canteen, get a QR code, and pick up at your convenience. Fast, simple, and delicious.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:gap-4">
            <Link href="/register" className="w-full sm:w-auto">
              <Button
                size="lg"
                className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-base text-white hover:from-orange-600 hover:to-red-600"
              >
                Order Now
              </Button>
            </Link>
            <Link href="/login" className="w-full sm:w-auto">
              <Button
                size="lg"
                variant="outline"
                className="w-full border-gray-300 bg-white text-base text-gray-700 hover:bg-gray-50"
              >
                Sign In
              </Button>
            </Link>
          </div>
        </div>
        <div className="order-1 flex justify-center md:order-2">
          <Image
            src="/image.png"
            alt="Kings Canteen Logo"
            width={400}
            height={400}
            className="h-auto w-32 sm:w-52 md:w-64"
          />
        </div>
      </div>
    </section>
  );
}
