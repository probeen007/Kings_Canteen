import { formatNPR } from "@/lib/utils";
import type { CartItem as CartItemType } from "@/store/cartStore";

type CartItemProps = {
  item: CartItemType;
  onIncrease: () => void;
  onDecrease: () => void;
  onRemove: () => void;
};

export function CartItem({ item, onIncrease, onDecrease, onRemove }: CartItemProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-slate-700">{item.name}</p>
        <p className="text-xs text-slate-400">{formatNPR(item.price)}</p>
      </div>
      <div className="flex items-center gap-2">
        <button className="h-7 w-7 rounded-full border border-neutral-200" onClick={onDecrease} type="button">
          -
        </button>
        <span className="text-sm font-semibold text-slate-700">{item.quantity}</span>
        <button className="h-7 w-7 rounded-full border border-neutral-200" onClick={onIncrease} type="button">
          +
        </button>
        <button className="text-xs text-red-600" onClick={onRemove} type="button">
          Remove
        </button>
      </div>
    </div>
  );
}