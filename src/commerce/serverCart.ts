import { create } from "zustand";
import { persist } from "zustand/middleware";
type Cart = {
  lines: Record<string, number>;
  key: string;
  method: "mpesa" | "card";
  change: (id: string, n: number) => void;
  choose: (method: "mpesa" | "card") => void;
  clear: () => void;
};
export const useServerCart = create<Cart>()(
  persist(
    (set) => ({
      lines: {},
      key: crypto.randomUUID(),
      method: "mpesa",
      change: (id, n) =>
        set((s) => ({
          lines: { ...s.lines, [id]: Math.max(0, Math.min(10, n)) },
          key: crypto.randomUUID(),
        })),
      choose: (method) =>
        set((s) => ({
          method,
          key: s.method === method ? s.key : crypto.randomUUID(),
        })),
      clear: () => set({ lines: {}, key: crypto.randomUUID() }),
    }),
    { name: "findbox.cart.server.v1" },
  ),
);
