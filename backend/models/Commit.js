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
		userGithubId: String
	},
	{ timestamps: true }
);

module.exports = mongoose.model("Commit", commitSchema);
