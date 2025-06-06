const mongoose = require("mongoose");

const issueSchema = new mongoose.Schema({
	issueId: { type: Number, unique: true },
	title: String,
	body: String,
	state: String,
	createdAt: Date,
	updatedAt: Date,
	closedAt: Date,
	repository: String,
	org: String,
	user: {
		login: String,
		id: Number,
		avatar_url: String
	},
	labels: [Object],
	comments: Number,
	url: String,
	placeholder: { type: Boolean, default: false }
});

module.exports = mongoose.model("Issue", issueSchema);
