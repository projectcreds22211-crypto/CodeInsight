import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ClerkProvider } from '@clerk/clerk-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';
import { HomePage } from './pages/HomePage';
import { ProjectsPage } from './pages/ProjectsPage';
import { AnalyzePage } from './pages/AnalyzePage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { SignInPage } from './pages/auth/SignInPage';
import { SignUpPage } from './pages/auth/SignUpPage';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '';

const isKeyValid = (key: string) => {
  return (
    (key.startsWith('pk_test_') || key.startsWith('pk_live_')) &&
    key.length > 20 &&
    key !== 'pk_test_dummy_key_for_dev'
  );
};

export const App: React.FC = () => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  if (!isKeyValid(PUBLISHABLE_KEY)) {
    return (
      <div className="min-h-screen bg-[#FBEEDD] flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md p-8 rounded-3xl bg-[#FFF8EE] border border-[#EDE0CC] shadow-md space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#6B4CE6]/10 text-[#6B4CE6] flex items-center justify-center mx-auto font-bold">
            <span className="text-xl">🔑</span>
          </div>
          <h1 className="text-xl font-bold font-display text-[#211F1D]">
            Clerk Auth Configuration Required
          </h1>
          <p className="text-xs text-[#57534E] leading-relaxed">
            `VITE_CLERK_PUBLISHABLE_KEY` is missing or unconfigured in your local environment.
          </p>
          <div className="p-3 rounded-xl bg-[#211F1D] text-left text-xs font-mono text-[#FF9EB0] space-y-1">
            <p className="text-[11px] text-[#A8A29E]"># Add to .env or codeinsight-web/.env:</p>
            <p>VITE_CLERK_PUBLISHABLE_KEY=pk_test_...</p>
          </div>
          <p className="text-[11px] text-[#78716C]">
            Get your publishable key from your{' '}
            <a
              href="https://dashboard.clerk.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-[#6B4CE6]"
            >
              Clerk Dashboard
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            {/* Public Authentication Routes */}
            <Route path="/sign-in/*" element={<SignInPage />} />
            <Route path="/sign-up/*" element={<SignUpPage />} />

            {/* Protected Application Routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<AppLayout />}>
                <Route index element={<HomePage />} />
                <Route path="projects" element={<ProjectsPage />} />
                <Route path="analyze" element={<AnalyzePage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </ClerkProvider>
  );
};

export default App;
