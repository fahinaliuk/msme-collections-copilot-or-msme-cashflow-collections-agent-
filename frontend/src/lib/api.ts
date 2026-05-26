import axios from "axios";

// API base URL:
//   NEXT_PUBLIC_API_URL — set at build time for Vercel/Render production
//   falls back to "" (same-origin via Next.js rewrites) for Docker/local dev
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    "Content-Type": "application/json",
  },
});

// Automatic JWT interceptor
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Redirect on 401 Unauthorized
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window !== "undefined" && error.response && error.response.status === 401) {
      const isLoginPath = window.location.pathname === "/login" || window.location.pathname === "/register";
      if (!isLoginPath) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

// Endpoints
export const authAPI = {
  signup: async (data: any) => {
    const response = await api.post("/api/auth/signup", data);
    return response.data;
  },
  login: async (formData: FormData) => {
    const response = await api.post("/api/auth/login", formData, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    return response.data;
  },
  me: async () => {
    const response = await api.get("/api/auth/me");
    return response.data;
  },
};

export const promisesAPI = {
  list: async (params?: { status?: string; customer_name?: string }) => {
    const response = await api.get("/api/promises", { params });
    return response.data;
  },
  create: async (data: {
    customer_name: string;
    invoice_id?: string;
    promised_amount: number;
    promised_date: string;
    notes?: string;
  }) => {
    const response = await api.post("/api/promises", data);
    return response.data;
  },
  update: async (id: string, data: { status: string; notes?: string }) => {
    const response = await api.patch(`/api/promises/${id}`, data);
    return response.data;
  },
};

export const disputesAPI = {
  list: async (params?: { status?: string; customer_name?: string }) => {
    const response = await api.get("/api/disputes", { params });
    return response.data;
  },
  create: async (data: {
    customer_name: string;
    invoice_id?: string;
    reason: string;
    description?: string;
    disputed_amount?: number;
  }) => {
    const response = await api.post("/api/disputes", data);
    return response.data;
  },
  update: async (id: string, data: { status: string; resolution_notes?: string }) => {
    const response = await api.patch(`/api/disputes/${id}`, data);
    return response.data;
  },
};

export const timelineAPI = {
  list: async (customer_name: string, limit?: number) => {
    const response = await api.get(`/api/collections/customers/${encodeURIComponent(customer_name)}/timeline`, {
      params: { limit },
    });
    return response.data;
  },
};

export const invoicesAPI = {
  upload: async (formData: FormData) => {
    const response = await api.post("/api/invoices/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },
  confirm: async (data: any) => {
    const response = await api.post("/api/invoices/confirm", data);
    return response.data;
  },
  list: async () => {
    const response = await api.get("/api/invoices");
    return response.data;
  },
};

export const dashboardAPI = {
  getSummary: async () => {
    const response = await api.get("/api/dashboard/summary");
    return response.data;
  },
  getCustomers: async () => {
    const response = await api.get("/api/dashboard/customers");
    return response.data;
  },
};

export const remindersAPI = {
  generate: async (data: { customer_name: string; outstanding_amount: number; max_days_overdue: number; tone: string }) => {
    const response = await api.post("/api/collections/reminders/generate", data);
    return response.data;
  },
  logAction: async (data: any) => {
    const response = await api.post("/api/collections/actions", data);
    return response.data;
  },
};

export default api;
