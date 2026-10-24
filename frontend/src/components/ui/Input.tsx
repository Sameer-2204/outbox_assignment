'use client';

import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = '', id, ...props }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
          focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500
          placeholder:text-gray-400 disabled:bg-gray-50 disabled:text-gray-500
          ${error ? 'border-red-400 focus:ring-red-500' : ''}
          ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function TextArea({ label, error, className = '', id, ...props }: TextAreaProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm
          focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500
          placeholder:text-gray-400 disabled:bg-gray-50 disabled:text-gray-500
          resize-vertical min-h-[100px]
          ${error ? 'border-red-400 focus:ring-red-500' : ''}
          ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
