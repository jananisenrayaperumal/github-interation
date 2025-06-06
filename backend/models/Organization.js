const mongoose = require("mongoose");

const organizationSchema = new mongoose.Schema(
	{
		githubId: { type: String, required: true },
		login: { type: String, required: true },
		description: String,
		avatar_url: String,
		url: String,
		userGithubId: String
	},
	{ timestamps: true }
);

module.exports = mongoose.model("Organization", organizationSchema);
