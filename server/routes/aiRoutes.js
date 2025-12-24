// server/routes/aiRoutes.js

import express from "express";
import {
  generateArticle,
  generateBlogTitle,
  generateImage,
  removeImageBackground,
  removeImageObject,
  resumeReview,
} from "../controllers/aiController.js";
import { auth } from "../middlewares/auth.js";
import { upload } from "../configs/multer.js";

const aiRouter = express.Router();

// ROUTE EXECUTION CHAIN:
// 1. requireAuth: Checks for a valid token. If invalid, it stops the request here.
// 2. auth: Your custom middleware runs to check plans and usage.
// 3. generateArticle: Your controller logic runs.
aiRouter.post("/generate-article", auth, generateArticle);
aiRouter.post("/generate-blog-title", auth, generateBlogTitle);
aiRouter.post("/generate-image", auth, generateImage);
aiRouter.post(
  "/remove-image-background",
  auth,
  upload.single("image"),
  removeImageBackground
);

aiRouter.post(
  "/remove-image-object",
  auth,
  upload.single("image"),
  removeImageObject
);
aiRouter.post("/resume-review", upload.single("resume"), auth, resumeReview);

export default aiRouter;
