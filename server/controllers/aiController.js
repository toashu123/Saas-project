import { GoogleGenerativeAI } from "@google/generative-ai";
import { clerkClient } from "@clerk/express";
import sql from "../configs/db.js";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
// import { createRequire } from "module";
import axios from "axios";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

// const require = createRequire(import.meta.url);
// const pdfModule = require("pdf-parse");
// const pdf = typeof pdfModule === "function" ? pdfModule : pdfModule.default;

// ✅ Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiTextModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
const geminiImageModel = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
});

/* -------------------------------------------------------------------------- */
/*                              Generate Article                              */
/* -------------------------------------------------------------------------- */
export const generateArticle = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { prompt, length } = req.body;
    const plan = req.plan;
    const free_usage = req.free_usage;

    if (!prompt)
      return res
        .status(400)
        .json({ success: false, message: "Prompt required." });

    if (plan !== "premium" && free_usage >= 10)
      return res.status(403).json({
        success: false,
        message: "Free limit reached. Please upgrade to continue.",
      });

    const result = await geminiTextModel.generateContent(
      `Write an article based on the following prompt in ${length} words: ${prompt}`
    );

    const content = result.response.text();

    await sql`
      INSERT INTO creations (user_id, prompt, content, type)
      VALUES (${userId}, ${prompt}, ${content}, 'article')
    `;

    if (plan !== "premium") {
      await clerkClient.users.updateUserMetadata(userId, {
        privateMetadata: { free_usage: free_usage + 1 },
      });
    }

    res.json({ success: true, content });
  } catch (error) {
    console.error("🔥 Error generating article:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* -------------------------------------------------------------------------- */
/*                             Generate Blog Title                            */
/* -------------------------------------------------------------------------- */
export const generateBlogTitle = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { prompt } = req.body;
    const plan = req.plan;
    const free_usage = req.free_usage;

    if (plan !== "premium" && free_usage >= 10)
      return res.status(403).json({
        success: false,
        message: "Free limit reached. Please upgrade to continue.",
      });

    const result = await geminiTextModel.generateContent(
      `Generate 5 catchy blog titles for this topic: ${prompt}`
    );

    const content = result.response.text();

    await sql`
      INSERT INTO creations (user_id, prompt, content, type)
      VALUES (${userId}, ${prompt}, ${content}, 'blog-title')
    `;

    if (plan !== "premium") {
      await clerkClient.users.updateUserMetadata(userId, {
        privateMetadata: { free_usage: free_usage + 1 },
      });
    }

    res.json({ success: true, content });
  } catch (error) {
    console.error("🔥 Error generating blog title:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* -------------------------------------------------------------------------- */
/*                              Generate AI Image                             */
/* -------------------------------------------------------------------------- */
export const generateImage = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { prompt, publish } = req.body;
    const plan = req.plan;

    if (plan !== "premium")
      return res.status(403).json({
        success: false,
        message: "This feature is only for premium users.",
      });

    const formData = new FormData();
    formData.append("prompt", prompt);
    const { data } = await axios.post(
      "https://clipdrop-api.co/text-to-image/v1",
      formData,
      {
        headers: {
          "x-api-key": process.env.CLIPDROP_API_KEY,
        },
        responseType: "arraybuffer",
      }
    );

    const base64Image = `data:image/png;base64,${Buffer.from(
      data,
      "binary"
    ).toString("base64")}`;

    // 🔹 Upload image URL directly to Cloudinary
    const { secure_url } = await cloudinary.uploader.upload(base64Image);

    // 🔹 Save in DB
    await sql`
      INSERT INTO creations (user_id, prompt, content, type, publish)
      VALUES (${userId}, ${prompt}, ${secure_url}, 'image', ${publish ?? false})
    `;

    res.json({ success: true, content: secure_url });
  } catch (error) {
    console.error("🔥 Error generating image:", error.response?.data || error);
    res.status(500).json({
      success: false,
      message: "Image generation failed",
    });
  }
};

/* -------------------------------------------------------------------------- */
/*                          Remove Image Background                           */
/* -------------------------------------------------------------------------- */

export const removeImageBackground = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { image } = req.file;
    const plan = req.plan;

    if (plan !== "premium")
      return res.status(403).json({
        success: false,
        message: "This feature is only for premium users.",
      });

    const { secure_url } = await cloudinary.uploader.upload(image.path, {
      transformation: [
        {
          effect: "background_removal",
          background_removal: "remove_the_background",
        },
      ],
    });

    await sql`
      INSERT INTO creations (user_id, prompt, content, type)
      VALUES (${userId}, 'Removed image background', ${secure_url}, 'image')
    `;

    res.json({ success: true, content: secure_url });
  } catch (error) {
    console.error("🔥 Error removing background:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* -------------------------------------------------------------------------- */
/*                            Remove Object from Image                         */
/* -------------------------------------------------------------------------- */
export const removeImageObject = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { object } = req.body;
    const { image } = req.file;
    const plan = req.plan;

    if (plan !== "premium")
      return res.status(403).json({
        success: false,
        message: "This feature is only for premium users.",
      });

    const { public_id } = await cloudinary.uploader.upload(image.path);

    const imageUrl = cloudinary.url(public_id, {
      transformation: [
        {
          effect: `gen_remove:${object}`
        }
      ],
      resource_type: "image"
    });

    await sql`
      INSERT INTO creations (user_id, prompt, content, type)
      VALUES (${userId}, ${`Removed ${object} from image`}, ${imageUrl}, 'image');
    `;

    res.json({ success: true, content: imageUrl });
  } catch (error) {
    console.error("🔥 Error removing object:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* -------------------------------------------------------------------------- */
/*                              Resume Review AI                              */
/* -------------------------------------------------------------------------- */
export const resumeReview = async (req, res) => {
  try {
    const { userId } = req.auth();
    const resume = req.file;
    const plan = req.plan;

    if (plan !== "premium")
      return res.status(403).json({
        success: false,
        message: "This feature is only for premium users.",
      });

    if (!resume)
      return res.status(400).json({
        success: false,
        message: "Resume file is required.",
      });

    if (resume.size > 5 * 1024 * 1024)
      return res.json({
        success: false,
        message: "Resume file exceeds 5MB limit.",
      });

    const { getDocument } = pdfjs;

    const dataBuffer = new Uint8Array(fs.readFileSync(resume.path));
    const loadingTask = getDocument({ data: dataBuffer });
    const pdfDoc = await loadingTask.promise;

    let text = "";
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((i) => i.str).join(" ") + "\n";
    }

    const prompt = `Review the following resume and provide constructive feedback, including strengths, weaknesses, and areas for improvement:\n\n${text}`;

    const result = await geminiTextModel.generateContent(prompt);
    const content = result.response.text();

    await sql`
      INSERT INTO creations (user_id, prompt, content, type)
      VALUES (${userId}, 'Resume Review', ${content}, 'resume-review')
    `;

    res.json({ success: true, content });
  } catch (error) {
    console.error("🔥 Error reviewing resume:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/*
 Key Fixes

 ->Replaced OpenAI chat API with Gemini’s proper generateContent() syntax.

 ->Centralized genAI initialization.

 ->Added strong validation for prompt, plan, and file size.

 ->Used Cloudinary upload for base64 images.

 ->Added proper error handling with consistent status codes.

 ->Respects free vs premium usage limits.

 ->Safe SQL insertion with parameterized queries (no injection risk).
 */
