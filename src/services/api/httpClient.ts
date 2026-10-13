import axios from 'axios';

export const httpClient = axios.create({
  baseURL: '/api',
  timeout: 5_000,
  headers: {
    Accept: 'application/json',
  },
});
