import api from './axios';

export async function openDirectChat(otherUserId) {
  const response = await api.post(`/chats/direct/${otherUserId}`);
  return response.data;
}

export async function listChats() {
  const response = await api.get('/chats');
  return response.data;
}

export async function getChatById(chatId) {
  const response = await api.get(`/chats/${chatId}`);
  return response.data;
}

export async function getChatMessages(chatId, params = {}) {
  const response = await api.get(`/chats/${chatId}/messages`, { params });
  return response.data;
}

export async function sendChatMessage(chatId, payload) {
  const response = await api.post(`/chats/${chatId}/messages`, payload);
  return response.data;
}

export async function uploadChatImage(chatId, imageFile) {
  const formData = new FormData();
  formData.append('image', imageFile);

  const response = await api.post(`/chats/${chatId}/media`, formData);
  return response.data;
}

export async function editChatMessage(chatId, messageId, text) {
  const response = await api.patch(`/chats/${chatId}/messages/${messageId}`, { text });
  return response.data;
}

export async function deleteChatMessage(chatId, messageId) {
  const response = await api.delete(`/chats/${chatId}/messages/${messageId}`);
  return response.data;
}

export async function toggleChatMessageReaction(chatId, messageId, emoji) {
  const response = await api.patch(`/chats/${chatId}/messages/${messageId}/reactions`, { emoji });
  return response.data;
}

export async function markChatRead(chatId) {
  const response = await api.patch(`/chats/${chatId}/read`);
  return response.data;
}

export async function toggleChatEncryption(chatId, enabled) {
  const response = await api.patch(`/chats/${chatId}/encryption`, { enabled });
  return response.data;
}

export async function deleteChat(chatId) {
  const response = await api.delete(`/chats/${chatId}`);
  return response.data;
}

export async function deleteDirectChatWithUser(otherUserId) {
  const response = await api.delete(`/chats/direct/${otherUserId}`);
  return response.data;
}
