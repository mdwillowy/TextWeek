import api from './axios';

export async function updateMySettings(payload) {
  const response = await api.patch('/users/me/settings', payload);
  return response.data;
}

export async function requestAccountDeletion(payload) {
  const response = await api.post('/users/me/request-deletion', payload);
  return response.data;
}
