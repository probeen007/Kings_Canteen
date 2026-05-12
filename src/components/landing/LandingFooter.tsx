import Link from "next/link";
import Image from "next/image";

export function LandingFooter() {
  return (
    <footer className="bg-gray-900 py-12 text-white">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-8 grid gap-8 md:grid-cols-3">
          <div>
            <div className="mb-4 flex items-center gap-2">
              <Image src="/image.png" alt="Kings Canteen" width={32} height={32} />
              <h4 className="text-lg font-bold">Kings Canteen</h4>
            </div>
            <p className="text-sm text-gray-400">Fast, Fresh, Delicious.</p>
          </div>
          <div>
            <h4 className="mb-4 font-semibold">Quick Links</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>
                <Link href="/login" className="transition hover:text-white">
                  Sign In
                </Link>
              </li>
              <li>
                <Link href="/register" className="transition hover:text-white">
                  Register
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="mb-4 font-semibold">Support</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>
                <a href="#" className="transition hover:text-white">
                  Contact Us
                </a>
              </li>
              <li>
                <a href="#" className="transition hover:text-white">
                  FAQ
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-700 pt-8 text-center text-sm text-gray-400">
          <p>© 2026 Kings Canteen. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
