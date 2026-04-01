/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"SF Pro Display"',
          'Segoe UI',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
      colors: {
        macos: {
          sidebar: 'rgba(246, 246, 246, 0.85)',
          'sidebar-border': 'rgba(0, 0, 0, 0.08)',
          'main-bg': '#ffffff',
          'gray-50': '#f9fafb',
          'gray-100': '#f3f4f6',
          'gray-200': '#e5e7eb',
          'gray-300': '#d1d5db',
          'gray-400': '#9ca3af',
          'gray-500': '#6b7280',
          'gray-600': '#4b5563',
          'gray-700': '#374151',
          'gray-800': '#1f2937',
          'gray-900': '#111827',
          accent: '#007aff',
          'accent-hover': '#0051d5',
        },
      },
      borderRadius: {
        'macos': '12px',
        'macos-sm': '8px',
        'macos-lg': '16px',
      },
      backdropBlur: {
        'macos': '20px',
      },
      animation: {
        'pulse-highlight': 'pulse-highlight 2s ease-in-out',
      },
      keyframes: {
        'pulse-highlight': {
          '0%, 100%': { backgroundColor: 'transparent' },
          '20%': { backgroundColor: 'rgba(59, 130, 246, 0.15)' },
          '50%': { backgroundColor: 'rgba(59, 130, 246, 0.1)' },
          '80%': { backgroundColor: 'rgba(59, 130, 246, 0.05)' },
        },
      },
    },
  },
  plugins: [],
}
