const express = require("express");
const router = express.Router();

const {
	getCollections,
	getCollectionData,
	searchCollection,
	deleteGithubCollections,
	getUserTickets,
	getRepositories,
	getRepoAggregatedData
} = require("../controllers/dbController");
const { globalSearch } = require("../controllers/globalSearchController");

router.get("/collection/:name", getCollectionData);
router.get("/collection/:name/search", searchCollection);
router.get("/global-search", globalSearch);
router.get("/user-tickets", getUserTickets);
router.delete("/delete-github-collections", deleteGithubCollections);
router.get("/repos", getRepositories);
router.get("/repos/:orgLogin/:repoName/data", getRepoAggregatedData);
router.get("/:collection", getCollections);

module.exports = router;
