// 1. CONFIGURE ENVIRONMENT VARIABLES (MUST BE AT THE VERY TOP)
import 'dotenv/config';

// 2. IMPORT NECESSARY PACKAGES
import express from 'express';
import cors from 'cors';
import { clerkMiddleware } from '@clerk/express'; // ✅ REMOVED requireAuth import
import aiRouter from './routes/aiRoutes.js'; 
import connectCloudinary from './configs/cloudinary.js';
import userRouter from './routes/userRoutes.js';

// 3. INITIALIZE THE EXPRESS APP
const app = express();
const PORT = process.env.PORT || 8000;
await connectCloudinary();

// 4. SETUP CORE MIDDLEWARES
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json());

// Clerk middleware - only sets up req.auth, doesn't block
app.use(clerkMiddleware());

// Logging middleware
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.url}`);
  console.log("📦 Body:", req.body);
  console.log("🔑 Headers:", req.headers.authorization);
  next();
});

// Home route
app.get('/', (req, res) => {
  res.send('Server is running!');
});

// ❌ REMOVE THIS LINE - IT'S BLOCKING EVERYTHING!
// app.use(requireAuth());

// 5. DEFINE ROUTES
app.use('/api/ai', aiRouter);
app.use('/api/user',userRouter)

// 6. START THE SERVER
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
