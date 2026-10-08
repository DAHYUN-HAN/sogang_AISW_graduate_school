export type AdminDialogButton = { text?: string; style?: "default" | "cancel" | "destructive"; onPress?: () => void };
export type AdminDialog = { title: string; message?: string; buttons?: AdminDialogButton[]; cancelable?: boolean; onDismiss?: () => void };

export function createAdminDialogQueue() {
  const pending: AdminDialog[] = [];
  const listeners = new Set<() => void>();
  let generation = 0;
  const publish = () => listeners.forEach((listener) => listener());
  const buttons = () => pending[0]?.buttons?.length ? pending[0].buttons : [{ text: "확인" }];
  const choose = (index: number, expected = pending[0]) => {
    if (pending[0] !== expected) return;
    const button = buttons()?.[index];
    if (!pending.length || !button) return;
    const origin = generation;
    pending.shift();
    publish();
    if (origin === generation) button.onPress?.();
  };
  return {
    current: () => pending[0] ?? null,
    generation: () => generation,
    clear: () => { pending.length = 0; generation++; publish(); },
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    push: (dialog: AdminDialog) => { pending.push(dialog); publish(); },
    choose,
    cancel: (expected = pending[0]) => {
      if (pending[0] !== expected) return;
      const current = pending[0];
      if (!current || current.cancelable === false) return;
      const index = buttons()?.findIndex((button) => button.style === "cancel") ?? -1;
      if (index >= 0) choose(index);
      else { const origin = generation; pending.shift(); publish(); if (origin === generation) current.onDismiss?.(); }
    },
  };
}
