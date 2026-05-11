import { Router } from "express";
import { healthController } from "../controllers/health.controller";
import { publicController } from "../controllers/public.controller";

export const router = Router();

router.get("/api/health", healthController.health);
router.get("/api/db", healthController.db);
router.get("/api/whoami", healthController.whoami);

router.get("/api/public/exhibitions", publicController.exhibitions);
router.get("/api/public/points", publicController.allPoints);
router.get(
  "/api/public/exhibitions/:expoSlug/points",
  publicController.pointsByExhibition
);
router.get(
  "/api/public/exhibitions/:expoSlug/points/:pointSlug/reviews",
  publicController.listPointReviews
);
router.post(
  "/api/public/exhibitions/:expoSlug/points/:pointSlug/reviews",
  publicController.createPointReview
);
router.post(
  "/api/public/exhibitions/:expoSlug/points/:pointSlug/reviews/:reviewId/like",
  publicController.toggleReviewLike
);
router.post("/api/public/feedback", publicController.createFeedback);

// Endpoint по ТЗ: получить одну точку по slug экспозиции и точки
router.get("/api/point/:exhibition/:slug", publicController.pointBySlug);