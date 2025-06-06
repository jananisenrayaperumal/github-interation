const express = require("express");
const router = express.Router();
const { githubAuth, githubCallback } = require("../controllers/authController");
const { githubFetcher } = require("../controllers/githubFetcherController");

router.get("/auth", githubAuth);
router.get("/auth/callback", githubCallback);
router.get("/sync", githubFetcher);

module.exports = router;
