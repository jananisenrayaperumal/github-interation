const mongoose = require("mongoose");

const repositorySchema = new mongoose.Schema(
	{
		githubId: { type: Number, required: true }, // repo ID
		name: { type: String, required: true }, // repo name
		full_name: String,
		description: String,
		html_url: String,
		private: Boolean,
		fork: Boolean,
		created_at: Date,
		updated_at: Date,
		pushed_at: Date,
		language: String,
		organizationLogin: String, // to link to the org
		ownerLogin: String, // owner login (org or user)
		userGithubId: String // to track who authenticated
	},
	{ timestamps: true }
);

module.exports = mongoose.model("Repository", repositorySchema);
