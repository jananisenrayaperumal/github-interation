// controllers/githubController.js
const axios = require("axios");
require("dotenv").config();
const User = require('../models/User');

const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const REDIRECT_URI = process.env.GITHUB_CALLBACK_URL;
const FRONTEND_URL = "http://localhost:4200";
const GITHUBAUTH_URL = "https://github.com/login/oauth/authorize"

const githubAuth = (req, res) => { 
	try {
		const scopes = ["repo", "read:org", "user"];
		const authUrl = `${GITHUBAUTH_URL}?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=${scopes.join(" ")}`;
		res.redirect(authUrl);
	} catch (error) {
		console.error(error);
	}
};

const githubCallback = async (req, res) => { 
  try {
    const code = req.query.code;
    if (!code) {
      return res.status(400).send("Missing authorization code");
    }
    const token = await exchangeCodeForToken(code);
    const user = await fetchAndUpsertUser(token);
    res.redirect(`${FRONTEND_URL}?token=${token}`);
  } catch (err) {
      console.error("OAuth Callback Error:", err.message);
      res.status(500).send("GitHub authentication failed");
  }
};
 
async function exchangeCodeForToken(code) {
  try {
    const tokenRes = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
      },
      { headers: { accept: "application/json" } }
    );
    if (tokenRes.data.error) {
      throw new Error(tokenRes.data.error_description || "Token exchange failed");
    }
    return tokenRes.data.access_token;
  } catch (error) {
    console.error("Error exchanging code for token:", error);
    throw error;
  }
}


async function fetchAndUpsertUser(token) {
  try {
    const userRes = await axios.get("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${token}` },
    });
  
    const emailRes = await axios.get("https://api.github.com/user/emails", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const githubUser = userRes.data;
    const primaryEmail = emailRes.data.find((email) => email.primary && email.verified)?.email;

    let user = await User.findOne({ githubId: githubUser.id });

    const userData = {
      githubId: githubUser.id,
      username: githubUser.login,
      email: primaryEmail,
      avatar: githubUser.avatar_url,
      githubToken: token,
    };

    if (user) {
      // Update existing user fields
      Object.assign(user, userData);
      await user.save();
    } else {
      user = new User(userData);
      await user.save();
    }

    return user;
  } catch (error) {
    console.error("Error fetching/upserting user:", error);
    throw error;
  }
  
}

module.exports = {
  githubAuth,
  githubCallback
};
