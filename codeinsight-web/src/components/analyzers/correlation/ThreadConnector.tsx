import React from 'react';
import { Clock, GitFork, Database, AlertTriangle, Layers, ArrowDown } from 'lucide-react';
import type { CorrelationRelationship } from '../../../lib/api-client';

interface ThreadConnectorProps {
  relationship: CorrelationRelationship;
  temporalDelta?: string;
}

export const ThreadConnector: React.FC<ThreadConnectorProps> = ({
  relationship,
  temporalDelta,
}) => {
  const getConnectorMeta = (rel: CorrelationRelationship) => {
    switch (rel) {
      case 'temporal':
        return {
          icon: <Clock className="w-3 h-3 text-indigo-600" />,
          label: temporalDelta ? `Temporal Delta: ${temporalDelta}` : 'Chronological Alignment',
          bg: '#EEF2FF',
          border: '#C7D2FE',
          color: '#4338CA',
        };
      case 'code-to-query':
        return {
          icon: <GitFork className="w-3 h-3 text-purple-600" />,
          label: 'Code Module → SQL Query Invocation',
          bg: '#F5F3FF',
          border: '#DDD6FE',
          color: '#6D28D9',
        };
      case 'query-to-runtime':
        return {
          icon: <Database className="w-3 h-3 text-amber-600" />,
          label: 'Unindexed Query → Pool Exhaustion / Latency',
          bg: '#FFFBEB',
          border: '#FDE68A',
          color: '#B45309',
        };
      case 'code-to-runtime':
        return {
          icon: <AlertTriangle className="w-3 h-3 text-rose-600" />,
          label: 'Code Debt → Operational Error Signal',
          bg: '#FFF1F2',
          border: '#FECDD3',
          color: '#BE123C',
        };
      case 'cross-layer':
      default:
        return {
          icon: <Layers className="w-3 h-3 text-emerald-600" />,
          label: 'Multi-Layer System Correlation',
          bg: '#ECFDF5',
          border: '#A7F3D0',
          color: '#047857',
        };
    }
  };

  const meta = getConnectorMeta(relationship);

  return (
    <div className="flex flex-col items-center my-1.5 relative">
      {/* Vertical Line */}
      <div className="h-6 w-0.5 border-l-2 border-dashed border-purple-300"></div>

      {/* Pill Badge */}
      <div
        className="px-2.5 py-0.5 rounded-full text-[10px] font-medium border flex items-center gap-1.5 shadow-2xs z-10"
        style={{
          backgroundColor: meta.bg,
          borderColor: meta.border,
          color: meta.color,
        }}
      >
        {meta.icon}
        <span>{meta.label}</span>
        <ArrowDown className="w-2.5 h-2.5 opacity-70" />
      </div>

      {/* Vertical Line Continuation */}
      <div className="h-6 w-0.5 border-l-2 border-dashed border-purple-300"></div>
    </div>
  );
};
