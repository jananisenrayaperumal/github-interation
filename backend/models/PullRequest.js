const mongoose = require("mongoose");

const pullRequestSchema = new mongoose.Schema(
	{
		id: Number,
		number: Number,
		title: String,
		state: String,
		createdAt: Date,
		updatedAt: Date,
		closedAt: Date,
		mergedAt: Date,
		userLogin: String,
		html_url: String,
		repoName: String,
		orgLogin: String,
		userGithubId: String,
		assignees: [String],
		requested_reviewers: [String],
		mergedBy: String,
		placeholder: { type: Boolean, default: false }
	},
	{ timestamps: true }
);

module.exports = mongoose.model("PullRequest", pullRequestSchema);
