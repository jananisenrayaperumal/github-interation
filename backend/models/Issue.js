const mongoose = require("mongoose");

const issueSchema = new mongoose.Schema(
	{
		issueId: { type: Number, unique: true },
		number: Number,
		title: String,
		body: String,
		state: String,
		createdAt: Date,
		updatedAt: Date,
		closedAt: Date,
		repository: String,
		org: String,
		sourceRepo: String,
		sourceType: String,
		parentRepo: String,
		user: mongoose.Schema.Types.Mixed,
		assignees: [mongoose.Schema.Types.Mixed],
		labels: [mongoose.Schema.Types.Mixed],
		comments: { type: Number, default: 0 },
		url: String,
		locked: { type: Boolean, default: false },
		milestone: mongoose.Schema.Types.Mixed,
		placeholder: { type: Boolean, default: false },
		totalFetched: Number,
		limitApplied: Number,
		reason: String
	},
	{
		timestamps: true
	}
);

// Add indexes for common queries
issueSchema.index({ repository: 1, org: 1 });
issueSchema.index({ sourceRepo: 1 });
issueSchema.index({ state: 1 });
issueSchema.index({ createdAt: -1 });
issueSchema.index({ "user.login": 1 });
issueSchema.index({ placeholder: 1 });

module.exports = mongoose.model("Issue", issueSchema);
