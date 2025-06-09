const mongoose = require("mongoose");

const pullRequestSchema = new mongoose.Schema(
	{
		id: Number,
		number: Number,
		title: String,
		body: String,
		state: String,
		createdAt: Date,
		updatedAt: Date,
		closedAt: Date,
		mergedAt: Date,
		merged: { type: Boolean, default: false },
		mergeable: Boolean,
		mergeCommitSha: String,
		userLogin: String,
		html_url: String,
		diff_url: String,
		patch_url: String,
		repoName: String,
		orgLogin: String,
		sourceRepo: String,
		sourceType: String, // 'direct' or 'parent'
		parentRepo: String,
		userGithubId: String,
		placeholder: { type: Boolean, default: false },
		assignees: [String],
		requested_reviewers: [String],
		mergedBy: String,
		draft: { type: Boolean, default: false },
		locked: { type: Boolean, default: false },
		head: {
			ref: String,
			sha: String,
			label: String
		},
		base: {
			ref: String,
			sha: String,
			label: String
		},
		comments: { type: Number, default: 0 },
		review_comments: { type: Number, default: 0 },
		commits: { type: Number, default: 0 },
		additions: { type: Number, default: 0 },
		deletions: { type: Number, default: 0 },
		changed_files: { type: Number, default: 0 },
		limitApplied: Number
	},
	{ timestamps: true }
);

// Add indexes for common queries
pullRequestSchema.index({ userGithubId: 1 });
pullRequestSchema.index({ repoName: 1, orgLogin: 1 });
pullRequestSchema.index({ sourceRepo: 1 });
pullRequestSchema.index({ state: 1 });
pullRequestSchema.index({ createdAt: -1 });

module.exports = mongoose.model("PullRequest", pullRequestSchema);
