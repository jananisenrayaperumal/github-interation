const express = require("express");
const router = express.Router();

// Import controller
const {
	getCollections,
	getCollectionData,
	searchCollection,
	deleteGithubCollections
} = require("../controllers/dbController");

// Routes using controller methods
router.get("/:collection", getCollections);
router.get("/collection/:name", getCollectionData);
router.get("/collection/:name/search", searchCollection);
router.delete("/delete-github-collections", deleteGithubCollections);

module.exports = router;
