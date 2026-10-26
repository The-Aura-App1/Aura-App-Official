import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import AuthBackdrop, { Wordmark } from '../components/auth/AuthBackdrop';

// Placeholder until the real About page is written.
export default function About() {
  return (
    <AuthBackdrop>
      <main className="flex-1 flex flex-col items-center justify-center text-center px-5 py-16">
        <Wordmark size="sm" linked />
        <h1 className="mt-8 text-3xl sm:text-4xl font-bold text-aura-950">About Aura</h1>
        <p className="mt-4 max-w-md text-aura-800/80">This page is coming soon.</p>
        <Link to="/welcome" className="aura-glass-btn mt-8">
          <ArrowLeft size={16} /> Back
        </Link>
      </main>
    </AuthBackdrop>
  );
}
