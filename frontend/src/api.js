import axios from "axios";

// Use relative base; Vite proxy will forward to http://localhost:8080
const api = axios.create({ baseURL: "" });

api.interceptors.request.use((config) => {
  const t = localStorage.getItem("token");
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

export default api;

