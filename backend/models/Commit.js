const mongoose = require("mongoose");

const commitSchema = new mongoose.Schema(
	{
		sha: { type: String, required: true, unique: true },
		message: String,
		authorName: String,
		authorEmail: String,
		date: Date,
		html_url: String,
		repoName: String,
		orgLogin: String,
		userGithubId: String,
		branch: String,
		committerName: String,
		committerEmail: String,
		committerDate: Date,
		stats: {
			additions: Number,
			deletions: Number,
			total: Number
		},
		verified: Boolean,
		tree: {
			sha: String,
			url: String
		},
		parents: [
			{
				sha: String,
				url: String,
				html_url: String
			}
		],
		author: {
			login: String,
			id: Number,
			avatar_url: String,
			html_url: String
		},
		committer: {
			login: String,
			id: Number,
			avatar_url: String,
			html_url: String
		}
	},
	{ timestamps: true }
);

// Add indexes for common queries
commitSchema.index({ repoName: 1, orgLogin: 1 });
commitSchema.index({ userGithubId: 1 });
commitSchema.index({ authorName: 1 });
commitSchema.index({ authorEmail: 1 });
commitSchema.index({ branch: 1 });
commitSchema.index({ date: -1 });

module.exports = mongoose.model("Commit", commitSchema);
