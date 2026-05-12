"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Menu, X } from "lucide-react";

import { Button } from "@/components/ui/button";

export function LandingNav() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-100 bg-white shadow-sm">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 sm:gap-3">
          <Image
            src="/image.png"
            alt="Kings Canteen"
            width={40}
            height={40}
              className="h-8 w-auto sm:h-9"
          />
          <h1 className="text-[clamp(1.1rem,2.8vw,1.6rem)] font-bold bg-gradient-to-r from-orange-500 via-red-500 to-blue-600 bg-clip-text text-transparent">
            Kings Canteen
          </h1>
        </Link>
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            className="rounded-full border border-gray-200 p-2 text-gray-700 sm:hidden"
            aria-expanded={open}
            aria-label="Toggle menu"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>

        <div className="hidden items-center gap-3 sm:flex">
          <Link href="/login" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full border-gray-200 bg-white text-gray-700 hover:bg-gray-100">
              Sign In
            </Button>
          </Link>
          <Link href="/register" className="w-full sm:w-auto">
            <Button className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600">
              Get Started
            </Button>
          </Link>
        </div>

        {open ? (
          <div className="flex flex-col gap-2 sm:hidden">
            <Link href="/login" className="w-full" onClick={() => setOpen(false)}>
              <Button variant="outline" className="w-full border-gray-200 bg-white text-gray-700 hover:bg-gray-100">
                Sign In
              </Button>
            </Link>
            <Link href="/register" className="w-full" onClick={() => setOpen(false)}>
              <Button className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600">
                Get Started
              </Button>
            </Link>
          </div>
        ) : null}
      </div>
    </nav>
  );
}
