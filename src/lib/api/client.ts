import { v4 as uuidv4 } from 'uuid';

export interface ApiError extends Error {
  status: number;
  data?: unknown;
}

export interface RequestConfig extends RequestInit {
  retries?: number;
  retryDelay?: number;
  timeout?: number;
}

const DEFAULT_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1000;
const DEFAULT_TIMEOUT = 30000;

class ApiClient {
  private baseUrl: string;
  private refreshPromise: Promise<boolean> | null = null;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  private async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async fetchWithTimeout(
    url: string,
    config: RequestConfig
  ): Promise<Response> {
    const { timeout = DEFAULT_TIMEOUT, ...rest } = config;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...rest,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private async refreshAccessToken(): Promise<boolean> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) return false;

        const response = await fetch('/api/user/refresh-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        if (!response.ok) {
          localStorage.removeItem('refreshToken');
          return false;
        }

        const data = await response.json();
        if (data.refreshToken) {
          localStorage.setItem('refreshToken', data.refreshToken);
        }
        return true;
      } catch {
        return false;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  private async executeWithRetry<T>(
    url: string,
    config: RequestConfig,
    attempt: number = 0
  ): Promise<T> {
    const { retries = DEFAULT_RETRIES, retryDelay = DEFAULT_RETRY_DELAY } = config;

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Request-ID': uuidv4(),
        ...((config.headers as Record<string, string>) || {}),
      };

      const response = await this.fetchWithTimeout(url, {
        ...config,
        headers,
      });

      if (response.status === 401) {
        const refreshed = await this.refreshAccessToken();
        if (refreshed && attempt < retries) {
          return this.executeWithRetry(url, config, attempt + 1);
        }
        window.location.href = '/auth/signin';
        throw new Error('Unauthorized');
      }

      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`) as ApiError;
        error.status = response.status;
        try {
          error.data = await response.json();
        } catch {
          error.data = await response.text();
        }
        throw error;
      }

      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return await response.json() as T;
      }
      return await response.text() as T;
    } catch (error) {
      if (attempt < retries) {
        const delay = retryDelay * Math.pow(2, attempt);
        await this.wait(delay);
        return this.executeWithRetry(url, config, attempt + 1);
      }
      throw error;
    }
  }

  async get<T>(endpoint: string, config: RequestConfig = {}): Promise<T> {
    return this.executeWithRetry<T>(
      `${this.baseUrl}${endpoint}`,
      { ...config, method: 'GET' }
    );
  }

  async post<T>(endpoint: string, data: unknown, config: RequestConfig = {}): Promise<T> {
    return this.executeWithRetry<T>(
      `${this.baseUrl}${endpoint}`,
      {
        ...config,
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  }

  async patch<T>(endpoint: string, data: unknown, config: RequestConfig = {}): Promise<T> {
    return this.executeWithRetry<T>(
      `${this.baseUrl}${endpoint}`,
      {
        ...config,
        method: 'PATCH',
        body: JSON.stringify(data),
      }
    );
  }

  async put<T>(endpoint: string, data: unknown, config: RequestConfig = {}): Promise<T> {
    return this.executeWithRetry<T>(
      `${this.baseUrl}${endpoint}`,
      {
        ...config,
        method: 'PUT',
        body: JSON.stringify(data),
      }
    );
  }

  async delete<T>(endpoint: string, config: RequestConfig = {}): Promise<T> {
    return this.executeWithRetry<T>(
      `${this.baseUrl}${endpoint}`,
      { ...config, method: 'DELETE' }
    );
  }
}

export const apiClient = new ApiClient('/api');
