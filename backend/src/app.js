import cors from 'cors';
import express from 'express';
import alertRoutes from './routes/alertRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import authRoutes from './routes/authRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import fanRoutes from './routes/fanRoutes.js';
import imageRoutes from './routes/imageRoutes.js';
import predictionRoutes from './routes/predictionRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import sensorRoutes from './routes/sensorRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import simulatorRoutes from './routes/simulatorRoutes.js';
import uploadedImageRoutes from './routes/uploadedImageRoutes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const app = express();
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim());

app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', uploadedImageRoutes);

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', mode: 'software-prototype' });
});
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/sensors', sensorRoutes);
app.use('/api/simulator', simulatorRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/fan', fanRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/predictions', predictionRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
