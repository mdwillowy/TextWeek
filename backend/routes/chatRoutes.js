import { Router } from 'express';
import {
  createOrOpenDirectChat,
  deleteMessage,
  deleteChat,
  deleteDirectChat,
  editMessage,
  getChatById,
  getMessages,
  listChats,
  markChatRead,
  reactToMessage,
  sendMessage,
  uploadChatImage,
  toggleChatEncryption,
} from '../controllers/chatController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { chatSendLimiter } from '../middleware/rateLimiters.js';
import { chatImageUpload } from '../middleware/uploadMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';
import {
  chatIdValidator,
  directChatValidator,
  deleteMessageValidator,
  editMessageValidator,
  getMessagesValidator,
  reactMessageValidator,
  sendMessageValidator,
} from '../validators/chatValidators.js';

const router = Router();

router.use(requireAuth);
router.post('/direct/:otherUserId', directChatValidator, validateRequest, createOrOpenDirectChat);
router.delete('/direct/:otherUserId', directChatValidator, validateRequest, deleteDirectChat);
router.get('/', listChats);
router.get('/:chatId', chatIdValidator, validateRequest, getChatById);
router.get('/:chatId/messages', getMessagesValidator, validateRequest, getMessages);
router.post('/:chatId/messages', chatSendLimiter, sendMessageValidator, validateRequest, sendMessage);
router.post('/:chatId/media', chatSendLimiter, chatIdValidator, validateRequest, chatImageUpload.single('image'), uploadChatImage);
router.patch('/:chatId/messages/:messageId', editMessageValidator, validateRequest, editMessage);
router.patch('/:chatId/messages/:messageId/reactions', reactMessageValidator, validateRequest, reactToMessage);
router.delete('/:chatId/messages/:messageId', deleteMessageValidator, validateRequest, deleteMessage);
router.delete('/:chatId', chatIdValidator, validateRequest, deleteChat);
router.patch('/:chatId/read', chatIdValidator, validateRequest, markChatRead);
router.patch('/:chatId/encryption', chatIdValidator, validateRequest, toggleChatEncryption);

export default router;
