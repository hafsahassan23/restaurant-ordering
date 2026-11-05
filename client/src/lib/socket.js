import { io } from 'socket.io-client';
import { API_URL } from './api';

export const staffSocket = (token) => io(API_URL, { auth: { token } });
export const tableSocket = (tableToken) => io(API_URL, { auth: { tableToken } });