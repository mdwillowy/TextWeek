import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import followRoutes from './routes/followRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import keyRoutes from './routes/keyRoutes.js';
import presenceRoutes from './routes/presenceRoutes.js';
import healthRoutes from './routes/healthRoutes.js';
import internalRoutes from './routes/internalRoutes.js';
import moderationRoutes from './routes/moderationRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { authLimiter } from './middleware/rateLimiters.js';
import { requestId } from './middleware/requestId.js';
import { requestLogger } from './middleware/requestLogger.js';
import { sanitizeInput } from './middleware/sanitizeInput.js';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (env.trustProxy) {
  app.set('trust proxy', 1);
}

app.use(requestId);
app.use(requestLogger);
app.use((req, res, next) => {
  res.setHeader('ngrok-skip-browser-warning', 'true');
  next();
});

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", "https://*.ngrok-free.app", "https://*.ngrok-free.dev", "wss://*.ngrok-free.app", "wss://*.ngrok-free.dev", "ws://*.ngrok-free.app", "ws://*.ngrok-free.dev"],
        imgSrc: ["'self'", "data:", "blob:", "https://*.ngrok-free.app", "https://*.ngrok-free.dev", "https://res.cloudinary.com"],
        // Fix for Fonts: We add fonts.googleapis.com here
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        // Fix for Fonts: We add fonts.gstatic.com here
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        scriptSrc: ["'self'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser requests (curl/Postman) with no Origin header.
      if (!origin) {
        return callback(null, true);
      }

      if (env.clientOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: env.requestBodyLimit }));
app.use(express.urlencoded({ extended: false, limit: env.requestBodyLimit }));
app.use(sanitizeInput);
app.use(cookieParser());

app.use('/', healthRoutes);
app.use('/api', healthRoutes);

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users/presence', presenceRoutes);
app.use('/api/users', userRoutes);
app.use('/api/follows', followRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/keys', keyRoutes);
app.use('/api/moderation', moderationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/internal', internalRoutes);

if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../frontend/dist');
  app.use(express.static(distPath));

  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
