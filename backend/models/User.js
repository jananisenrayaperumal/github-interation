const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
	githubId: { type: String, unique: true },
	username: String,
	email: String,
	avatar: String,
	githubToken: { type: String }
});

module.exports = mongoose.model("User", userSchema);
