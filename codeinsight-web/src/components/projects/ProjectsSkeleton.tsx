import React from 'react';

export const ProjectsSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[1, 2, 3, 4, 5, 6].map((idx) => (
        <div
          key={idx}
          className="p-6 space-y-4 animate-pulse"
          style={{
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--surface-card)',
            border: '1px solid var(--surface-outline)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#E7E4DD]/60 shrink-0" style={{ borderRadius: 'var(--radius-sm)' }} />
              <div className="space-y-2">
                <div className="h-4 w-32 bg-[#E7E4DD]/70 rounded" />
                <div className="h-3 w-24 bg-[#E7E4DD]/50 rounded" />
              </div>
            </div>
            <div className="h-5 w-14 bg-[#E7E4DD]/60" style={{ borderRadius: 'var(--radius-full)' }} />
          </div>
          <div className="pt-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--surface-bg)' }}>
            <div className="h-3 w-28 bg-[#E7E4DD]/50 rounded" />
            <div className="h-3 w-12 bg-[#E7E4DD]/50 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
};
