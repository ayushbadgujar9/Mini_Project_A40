// API base URL — uses VITE_API_URL env var in production, localhost in dev
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
export default API_BASE_URL;

