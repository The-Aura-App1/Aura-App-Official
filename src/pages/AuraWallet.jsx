import React from 'react';
import { Sparkles } from 'lucide-react';

export default function AuraWallet() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Sparkles size={24} className="text-aura-400" />
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Aura Wallet</h1>
      </div>
      <p className="text-[var(--text-muted)] text-sm">Coming soon — full wallet with balance, transaction history, and redemptions.</p>
    </div>
  );
}