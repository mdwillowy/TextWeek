import api from './axios';

export async function putMyKeyBundle(bundle) {
  const response = await api.put('/keys/bundle', bundle);
  return response.data;
}

export async function getUserKeyBundle(userId) {
  const response = await api.get(`/keys/bundle/${userId}`);
  return response.data;
}
