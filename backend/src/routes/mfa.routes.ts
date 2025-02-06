import express from "express";
import {
  disableMfa,
  enableMfa,
  verifyAndEnableMfa,
  verifyMfa,
} from "../controllers/mfa.controller";
import { protect } from "../middleware/auth.middleware";

const router = express.Router();

router.use(protect);

router.post("/enable", enableMfa);
router.post("/verify-and-enable", verifyAndEnableMfa);
router.post("/disable", disableMfa);
router.post("/verify", verifyMfa);

export default router;
