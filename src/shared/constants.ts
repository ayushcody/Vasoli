// Shared constants

export const APP_NAME = 'Vasoli';
export const APP_DESCRIPTION = 'Smart Personal Finance Management';

// Auth
export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MINUTES = 30;
export const SESSION_MAX_AGE = 24 * 60 * 60; // 24 hours
export const REFRESH_TOKEN_EXPIRY_DAYS = 30;

// Pagination
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// File Upload
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];

// Job Queue
export const JOB_BATCH_SIZE = 10;
export const JOB_RETRY_DELAY = 60000; // 1 minute
export const JOB_MAX_ATTEMPTS = 3;
export const JOB_CLEANUP_DAYS = 30;

// Health Score Weights
export const HEALTH_SCORE_WEIGHTS = {
  savingsRate: 0.3,
  budgetAdherence: 0.25,
  goalProgress: 0.2,
  spendingConsistency: 0.15,
  emergencyFund: 0.1,
};

// Categories
export const DEFAULT_CATEGORIES = [
  { name: 'Food & Dining', icon: '🍔', color: '#FF6B6B', type: 'EXPENSE' },
  { name: 'Transportation', icon: '🚗', color: '#4ECDC4', type: 'EXPENSE' },
  { name: 'Shopping', icon: '🛍️', color: '#FFE66D', type: 'EXPENSE' },
  { name: 'Entertainment', icon: '🎬', color: '#A8E6CF', type: 'EXPENSE' },
  { name: 'Bills & Utilities', icon: '💡', color: '#FF8B94', type: 'EXPENSE' },
  { name: 'Healthcare', icon: '🏥', color: '#C7CEEA', type: 'EXPENSE' },
  { name: 'Education', icon: '📚', color: '#B4A7D6', type: 'EXPENSE' },
  { name: 'Salary', icon: '💰', color: '#95E1D3', type: 'INCOME' },
  { name: 'Freelance', icon: '💼', color: '#F38181', type: 'INCOME' },
  { name: 'Investment', icon: '📈', color: '#AA96DA', type: 'INCOME' },
  { name: 'Other', icon: '📦', color: '#FCBAD3', type: 'EXPENSE' },
];

// Date Formats
export const DATE_FORMAT = 'yyyy-MM-dd';
export const DATETIME_FORMAT = 'yyyy-MM-dd HH:mm:ss';
export const DISPLAY_DATE_FORMAT = 'MMM dd, yyyy';
export const DISPLAY_DATETIME_FORMAT = 'MMM dd, yyyy HH:mm';

// Currency
export const DEFAULT_CURRENCY = 'USD';
export const CURRENCY_SYMBOL = '$';

// API Routes
export const API_ROUTES = {
  AUTH: {
    SIGNIN: '/api/auth/signin',
    SIGNUP: '/api/auth/register',
    SIGNOUT: '/api/auth/signout',
    REFRESH: '/api/user/refresh-token',
  },
  TRANSACTIONS: {
    BASE: '/api/transactions',
    BY_ID: (id: string) => `/api/transactions/${id}`,
    SUMMARY: '/api/transactions/summary',
    OCR: '/api/transactions/ocr',
  },
  BUDGETS: {
    BASE: '/api/budgets',
    BY_ID: (id: string) => `/api/budgets/${id}`,
    ALERTS: '/api/budgets/alerts',
  },
  GOALS: {
    BASE: '/api/goals',
    BY_ID: (id: string) => `/api/goals/${id}`,
    CONTRIBUTIONS: (id: string) => `/api/goals/${id}/contributions`,
    STATS: '/api/goals/stats',
  },
  RECURRING: {
    BASE: '/api/recurring',
    BY_ID: (id: string) => `/api/recurring/${id}`,
    UPCOMING: '/api/recurring/upcoming',
  },
  REMINDERS: {
    BASE: '/api/reminders',
    BY_ID: (id: string) => `/api/reminders/${id}`,
    COMPLETE: (id: string) => `/api/reminders/${id}/complete`,
    SNOOZE: (id: string) => `/api/reminders/${id}/snooze`,
    DISMISS: (id: string) => `/api/reminders/${id}/dismiss`,
    STATS: '/api/reminders/stats',
  },
  HEALTH_SCORE: {
    BASE: '/api/health-score',
    CALCULATE: '/api/health-score/calculate',
    HISTORY: '/api/health-score/history',
    COMPARISON: '/api/health-score/comparison',
  },
  CATEGORIES: {
    BASE: '/api/categories',
  },
};
