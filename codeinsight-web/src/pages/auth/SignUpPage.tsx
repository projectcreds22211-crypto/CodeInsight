import React from 'react';
import { SignUp } from '@clerk/clerk-react';
import { Terminal } from 'lucide-react';

export const SignUpPage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ backgroundColor: 'var(--surface-bg-marketing)' }}>
      {/* Brand Header */}
      <div className="mb-8 text-center space-y-4">
        <div className="flex items-center justify-center gap-3 mb-2">
          <div
            className="w-11 h-11 flex items-center justify-center text-white"
            style={{
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, var(--thread-purple), var(--accent-coral))',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <Terminal className="w-6 h-6" />
          </div>
          <h2 className="font-display text-2xl font-bold" style={{ color: 'var(--ink)' }}>
            CodeInsight
          </h2>
        </div>
        <div className="space-y-1">
          <h1 className="font-display text-xl font-bold" style={{ color: 'var(--ink)' }}>
            Create your account
          </h1>
          <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
            AI-Native Engineering Intelligence Platform
          </p>
        </div>
      </div>

      {/* Clerk Sign-Up Widget */}
      <div
        className="w-full max-w-md"
        style={{
          backgroundColor: 'var(--surface-card-marketing)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--surface-outline-marketing)',
          boxShadow: 'var(--shadow-card)',
          padding: 'var(--space-5)',
        }}
      >
        <SignUp
          routing="path"
          path="/sign-up"
          signInUrl="/sign-in"
          forceRedirectUrl="/"
        />
      </div>
    </div>
  );
};
