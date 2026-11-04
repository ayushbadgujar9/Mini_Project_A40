import axios from 'axios';

// API base URL — uses VITE_API_URL env var in production, localhost in dev
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Set globally so all axios calls (even relative paths) hit the right backend
axios.defaults.baseURL = API_BASE_URL;

export default API_BASE_URL;

