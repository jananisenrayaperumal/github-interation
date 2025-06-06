// config/db.js
const mongoose = require("mongoose");

const connectDB = async () => {
	try {
		const mongodbUserID = process.env.MONGODB_USER_ID;
		const clientSecret = process.env.MONGODB_CLIENT_SECRET;
		const connectionString = `mongodb+srv://${mongodbUserID}:${clientSecret}@cluster0.fymbxpb.mongodb.net/githubAuthApp?retryWrites=true&w=majority&appName=Cluster0`;

		mongoose.set("strictQuery", true);
		await mongoose.connect(connectionString);
		console.log("MongoDB connected successfully");
	} catch (err) {
		console.error("MongoDB connection error:", err);
		process.exit(1);
	}
};

module.exports = connectDB;
