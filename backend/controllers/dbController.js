// controllers/dbController.js
const mongoose = require("mongoose");

// Get all collection names
const getCollections = async (req, res) => {
	try {
		const collections = await mongoose.connection.db.listCollections().toArray();
		const collectionNames = collections.map(col => col.name);
		res.status(200).json({ collections: collectionNames });
	} catch (error) {
		console.error("Error fetching collections:", error);
		res.status(500).json({ error: "Failed to fetch collections" });
	}
};

// Get all documents from a given collection
const getCollectionData = async (req, res) => {
	const collectionName = req.params.name;
	try {
		const projection = collectionName === "users" ? { githubToken: 0 } : {};
		const data = await mongoose.connection.db.collection(collectionName).find({}, { projection }).toArray();
		console.log(data.flat());
		res.status(200).json(data);
	} catch (error) {
		console.error(`Error fetching data from ${collectionName}:`, error);
		res.status(500).json({ error: `Failed to fetch ${collectionName}` });
	}
};

// Search in a given collection
const searchCollection = async (req, res) => {
	const collectionName = req.params.name;
	const searchText = req.query.q;

	if (!searchText) {
		return res.status(400).json({ error: "Search query missing" });
	}

	try {
		const collection = mongoose.connection.db.collection(collectionName);
		const allDocs = await collection.find({}).toArray();

		const regex = new RegExp(searchText, "i");
		const filtered = allDocs.filter(doc => Object.values(doc).some(val => typeof val === "string" && regex.test(val)));

		res.status(200).json(filtered);
	} catch (err) {
		console.error(`Error searching in ${collectionName}:`, err);
		res.status(500).json({ error: "Search failed" });
	}
};

const deleteGithubCollections = async (req, res) => {
	try {
		const allCollections = await mongoose.connection.db.listCollections().toArray();

		const githubCollections = allCollections
			.map(col => col.name)
			.filter(name =>
				["organizations", "repositories", "issues", "pullrequests", "commits", "orgusers", "users"].includes(name)
			);

		for (const name of githubCollections) {
			await mongoose.connection.db.collection(name).drop().catch(err => {
				if (err.code === 26) {
					console.log(`Collection ${name} does not exist.`);
				} else {
					throw err;
				}
			});
		}

		res.status(200).json({ message: "All GitHub collections deleted successfully." });
	} catch (error) {
		console.error("Error deleting GitHub collections:", error);
		res.status(500).json({ error: "Failed to delete GitHub collections" });
	}
};

module.exports = {
	getCollections,
	getCollectionData,
	searchCollection,
	deleteGithubCollections
};
