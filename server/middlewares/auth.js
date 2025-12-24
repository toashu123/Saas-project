// server/middlewares/auth.js
import { clerkClient } from "@clerk/express";

/**
 * Custom authentication middleware for handling user authentication and plan verification
 * This middleware:
 * - Verifies user authentication via Clerk
 * - Checks if user has a premium plan
 * - Tracks free tier usage limits
 * - Attaches user plan and usage data to the request object
 */
export const auth = async (req, res, next) => {
  try {
    const data = req.auth();
    console.log("💡 Clerk Auth Data:", data);

    // Extract authentication data from Clerk middleware
    // req.auth() is provided by clerkMiddleware() in server.js
    const { userId, has } = req.auth();

    // Verify user is authenticated
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Check if user has a premium subscription plan
    const hasPremiumPlan = await has({ plan: "premium" });

    // Fetch user details from Clerk to access metadata
    const user = await clerkClient.users.getUser(userId);

    // Get the user's free tier usage count from private metadata
    // Defaults to 0 if not set
    const freeUsage = user.privateMetadata.free_usage || 0;

    // Attach usage data to request based on plan type
    if (!hasPremiumPlan) {
      // Free users: track their usage count
      req.free_usage = freeUsage;
    } else {
      // Premium users: unlimited usage (set to 0 for tracking)
      req.free_usage = 0;
    }

    // Attach user's plan type to request for use in controllers
    req.plan = hasPremiumPlan ? "premium" : "free";

    req.auth = () => ({
      userId,
      plan: req.plan,
      free_usage: req.free_usage,
    });

    // Continue to next middleware or route handler
    next();
  } catch (error) {
    // Log error for debugging purposes
    console.error("Auth middleware error:", error.message);

    // Return 401 error to client
    return res.status(401).json({ error: "Unauthorized" });
  }
};
