import React, { createContext, useContext, useEffect, useState } from 'react';
import { authAPI, removeAuthToken, getAuthToken, setLogoutCallback } from '../services/api';

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

const fallbackAuthContext: AuthContextType = {
  user: null,
  token: null,
  isLoading: false,
  isAuthenticated: false,
  isAdmin: false,
  error: null,
  login: async () => {
    throw new Error('AuthProvider is not mounted');
  },
  register: async () => {
    throw new Error('AuthProvider is not mounted');
  },
  logout: () => {},
  clearError: () => {},
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize from localStorage on mount
  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = getAuthToken();
      const storedUser = authAPI.getCurrentUser();

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(storedUser);
      } else {
        // Ensure we don't treat a stale token as authenticated.
        authAPI.logout();
        setToken(null);
        setUser(null);
      }

      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  // Register logout callback so apiFetch can clear React state on 401
  useEffect(() => {
    setLogoutCallback(() => {
      setToken(null);
      setUser(null);
      setError(null);
    });
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setError(null);
      setIsLoading(true);

      const response = await authAPI.login(email, password);
      const responseUser = response?.data?.user;
      const responseToken = response?.data?.token;

      if (responseToken && responseUser) {
        setToken(responseToken);
        setUser(responseUser);
      } else {
        // If the backend returns an unexpected payload, clear any saved token/user
        authAPI.logout();
        setToken(null);
        setUser(null);
        throw new Error('Unexpected login response from server');
      }

      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string) => {
    try {
      setError(null);
      setIsLoading(true);

      const response = await authAPI.register(name, email, password);
      const responseUser = response?.data?.user;
      const responseToken = response?.data?.token;

      if (responseToken && responseUser) {
        setToken(responseToken);
        setUser(responseUser);
      } else {
        authAPI.logout();
        setToken(null);
        setUser(null);
        throw new Error('Unexpected register response from server');
      }

      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Registration failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    authAPI.logout();
    setToken(null);
    setUser(null);
    setError(null); // Clear error on logout
  };

  const clearError = () => {
    setError(null);
  };

  const isAuthenticated = Boolean(token && user);
  const isAdmin = Boolean(user?.role === 'ADMIN');

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isAuthenticated,
    isAdmin,
    error,
    login,
    register,
    logout,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    if (import.meta.env.DEV) {
      console.error('useAuth called outside AuthProvider. Falling back to unauthenticated state.');
    }
    return fallbackAuthContext;
  }
  return context;
};
