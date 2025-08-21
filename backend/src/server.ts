import app, { initDb } from './app.js';
import { ensureBucket } from './config/s3.js';

async function startServer() {
  try {
    await initDb();
    console.log('DB initialized');
    
    // Добавляем создание/проверку бакета
    const bucketName = process.env.S3_BUCKET || 'videomarket';
    await ensureBucket(bucketName);
    console.log(`S3 bucket '${bucketName}' ready`);
    
    const PORT = process.env.PORT || 4000;
    
    app.listen(PORT, () => {
      console.log(`Backend listening on port ${PORT}`);
    });
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();