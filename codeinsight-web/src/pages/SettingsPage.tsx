import React from 'react';
import { ShieldCheck, Cpu } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold font-display" style={{ color: 'var(--ink)' }}>System Settings</h1>
        <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>Platform runtime details and backend configuration.</p>
      </div>

      <div className="space-y-4">
        {/* Environment Info */}
        <div
          className="p-6 space-y-4"
          style={{
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--surface-card)',
            border: '1px solid var(--surface-outline)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 flex items-center justify-center text-white"
              style={{ borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--ink)' }}
            >
              <ShieldCheck className="w-5 h-5" style={{ color: 'var(--accent-coral)' }} />
            </div>
            <div>
              <h3 className="font-bold text-sm" style={{ color: 'var(--ink)' }}>Authentication & Mode</h3>
              <p className="text-xs" style={{ color: 'var(--ink-soft)' }}>Clerk Auth Single-User Persona (Solo Builder MVP)</p>
            </div>
          </div>
        </div>

        {/* API Endpoint Config */}
        <div
          className="p-6 space-y-4"
          style={{
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--surface-card)',
            border: '1px solid var(--surface-outline)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 flex items-center justify-center"
              style={{
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(107, 76, 230, 0.1)',
                color: 'var(--thread-purple)',
              }}
            >
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm" style={{ color: 'var(--ink)' }}>Backend Fastify Service</h3>
              <p className="text-xs font-mono" style={{ color: 'var(--ink-soft)' }}>http://localhost:3001 (codeinsight-api)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
