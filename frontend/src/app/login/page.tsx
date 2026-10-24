'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function LoginPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.replace('/');
    }
  }, [user, router]);

  const handleGoogleLogin = () => {
    window.location.href = `${API_URL}/auth/google`;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <div className="bg-gray-800 text-gray-400 text-sm px-4 py-2">
        Login Screen
      </div>

      {/* Center card */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
          <h1 className="text-2xl font-bold text-center text-gray-900 mb-6">Login</h1>

          {/* Google button */}
          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-sm font-medium text-gray-700 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Login with Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">or sign up through email</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Email/Password (visual only - actual auth is Google) */}
          <div className="space-y-3">
            <input
              type="email"
              placeholder="Email ID"
              disabled
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-400 bg-gray-50"
            />
            <input
              type="password"
              placeholder="Password"
              disabled
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-400 bg-gray-50"
            />
          </div>

          <button
            disabled
            className="w-full mt-5 px-4 py-2.5 rounded-lg bg-emerald-500 text-white text-sm font-medium opacity-50 cursor-not-allowed"
          >
            Login
          </button>

          <p className="text-xs text-gray-400 text-center mt-3">
            Only Google OAuth login is supported
          </p>
        </div>
      </div>
    </div>
  );
}
