// controllers/syncController.js
const { fetchAndStoreOrganizations } = require("../services/githubFetcherService");
const User = require("../models/User");

const githubFetcher = async (req, res) => {
	try {
		const authHeader = req.headers.authorization;
		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			return res.status(401).json({ error: "No token provided" });
		}

		const token = authHeader.split(" ")[1];
		const user = await User.findOne({ githubToken: token });
		if (!user) return res.status(401).json({ error: "Unauthorized" });

		await fetchAndStoreOrganizations(token, user.githubId);

		res.status(200).json({ message: "GitHub data synced" });
	} catch (err) {
		console.error("Sync Error:", err.message);
		res.status(500).json({ error: "Failed to sync GitHub data" });
	}
};

module.exports = { githubFetcher };
