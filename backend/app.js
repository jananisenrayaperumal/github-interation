require("dotenv").config();
const connectDB = require("./config/db");

const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// DB connection
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
const dbRoutes = require("./routes/dbRoutes");
const authRoutes = require("./routes/authRoutes");

app.use("/api/github", authRoutes);
app.use("/api/db", dbRoutes);

app.get("/", (req, res) => {
	res.send("Welcome to Node");
});

// Server
app.listen(PORT, err => {
	if (!err) {
		console.log(`Server is listening on port ${PORT}`);
	} else {
		console.error(err);
	}
});
