import axios from "axios";

// Create Axios client with local prefix (next.config.js rewrites this to localhost:8000/api in development)
const api = axios.create({
  baseURL: typeof window !== "undefined" ? "" : "http://localhost:8000",
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
