const User = require("../models/User");
const Organization = require("../models/Organization");
const {
	fetchAndStoreIssues,
	fetchAndStorePullRequests,
	fetchAndStoreMembers,
	fetchAndStoreCommits
} = require("../services/githubFetcherService");
const axios = require("axios");
const Repository = require("../models/Repository");

const GIT_BASE_API = "https://api.github.com";

const githubFetcher = async (req, res) => {
	try {
		const authHeader = req.headers.authorization;
		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			return res.status(401).json({ error: "No token provided" });
		}

		const token = authHeader.split(" ")[1];
		const user = await User.findOne({ githubToken: token });
		if (!user) return res.status(401).json({ error: "Unauthorized" });

		fetchAndStoreOrganizations(token, user.githubId).catch(err => {
			console.error("Background sync failed:", err);
		});

		res.status(200).json({ message: "GitHub sync started in background" });
	} catch (err) {
		console.error("Sync Error:", err.message);
		res.status(500).json({ error: "Failed to start GitHub sync" });
	}
};

async function fetchAndStoreOrganizations(token, githubId) {
	const orgs = (await axios.get(`${GIT_BASE_API}/user/orgs`, {
		headers: { Authorization: `Bearer ${token}` }
	})).data;

	await Promise.all(
		orgs.map(async org => {
			await Organization.updateOne(
				{ githubId: org.id },
				{
					githubId: org.id,
					login: org.login,
					description: org.description,
					avatar_url: org.avatar_url,
					url: org.url,
					userGithubId: githubId
				},
				{ upsert: true }
			);

			await Promise.all([fetchAndStoreMembers(org.login, token), fetchAndStoreRepos(org.login, token, githubId)]);
		})
	);
}

async function fetchAndStoreRepos(orgLogin, token, githubId) {
	let page = 1;
	let allRepos = [];

	while (true) {
		const repos = (await axios.get(`${GIT_BASE_API}/orgs/${orgLogin}/repos`, {
			headers: { Authorization: `Bearer ${token}` },
			params: { per_page: 100, page }
		})).data;

		if (!repos.length) break;
		allRepos = allRepos.concat(repos);
		page++;
	}

	await Promise.all(
		allRepos.map(repo =>
			Repository.updateOne(
				{ githubId: repo.id },
				{
					githubId: repo.id,
					name: repo.name,
					full_name: repo.full_name,
					description: repo.description,
					html_url: repo.html_url,
					private: repo.private,
					fork: repo.fork,
					created_at: repo.created_at,
					updated_at: repo.updated_at,
					pushed_at: repo.pushed_at,
					language: repo.language,
					organizationLogin: orgLogin,
					ownerLogin: repo.owner.login,
					userGithubId: githubId
				},
				{ upsert: true }
			)
		)
	);

	const chunks = [];
	for (let i = 0; i < allRepos.length; i += 3) {
		chunks.push(allRepos.slice(i, i + 3));
	}

	for (const chunk of chunks) {
		await Promise.all(
			chunk.map(repo =>
				Promise.all([
					fetchAndStoreIssues(orgLogin, repo.name, token),
					fetchAndStorePullRequests(orgLogin, repo.name, token, githubId),
					fetchAndStoreCommits(orgLogin, repo.name, token, githubId)
				])
			)
		);
	}
}

module.exports = { githubFetcher };
