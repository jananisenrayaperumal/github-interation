const mongoose = require("mongoose");

const orgUserSchema = new mongoose.Schema({
	githubId: { type: Number, unique: true },
	login: String,
	avatar_url: String,
	org: String,
	html_url: String
});

module.exports = mongoose.model("OrgUser", orgUserSchema);
