import { formatNPR } from "@/lib/utils";

type CartSummaryProps = {
  totalItems: number;
  totalAmount: number;
  onCheckout: () => void;
  disabled?: boolean;
};

export function CartSummary({ totalItems, totalAmount, onCheckout, disabled = false }: CartSummaryProps) {
  return (
    <div className="border-t border-neutral-200 pt-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-500">Items</span>
        <span className="font-semibold text-slate-700">{totalItems}</span>
      </div>
      <div className="mt-2 flex items-center justify-between text-sm">
        <span className="text-slate-500">Total</span>
        <span className="font-semibold text-slate-700">{formatNPR(totalAmount)}</span>
      </div>
      <button
        className="mt-4 w-full rounded-lg bg-neutral-900 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        onClick={onCheckout}
        type="button"
        disabled={disabled}
      >
        Proceed to Checkout
      </button>
    </div>
  );
}