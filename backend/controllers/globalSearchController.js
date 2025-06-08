const Commit = require("../models/Commit");
const Issue = require("../models/Issue");
const PullRequest = require("../models/PullRequest");

const globalSearch = async (req, res) => {
    const searchText = req.query.q;
    
    console.log("I am searching",searchText)

  if (!searchText) {
    return res.status(400).json({ error: "Search query is missing" });
  }

  const regex = new RegExp(searchText, "i");

  try {
    const commits = await Commit.find({
      $or: [
        { message: regex },
        { authorName: regex },
        { repoName: regex },
        { orgLogin: regex },
      ],
    }).lean();

    const commitResults = commits.map((commit) => ({
      type: "commit",
      id: commit.sha,
      title: commit.message,
      user: commit.authorName,
      date: commit.date,
      url: commit.html_url,
      repoName: commit.repoName,
      org: commit.orgLogin,
      status: "N/A",
      description: "",
    }));

    // 2. Search Issues
    const issues = await Issue.find({
      $or: [
        { title: regex },
        { body: regex },
        { "user.login": regex },
        { repository: regex },
        { org: regex },
      ],
    }).lean();

    const issueResults = issues.map((issue) => ({
      type: "issue",
      id: issue.issueId,
      title: issue.title,
      user: issue.user?.login,
      date: issue.createdAt,
      url: issue.url,
      repoName: issue.repository,
      org: issue.org,
      status: issue.state,
      description: issue.body,
    }));

    const prs = await PullRequest.find({
      $or: [
        { title: regex },
        { userLogin: regex },
        { repoName: regex },
        { orgLogin: regex },
      ],
    }).lean();

    const prResults = prs.map((pr) => ({
      type: "pull_request",
      id: pr.id,
      title: pr.title,
      user: pr.userLogin,
      date: pr.createdAt,
      url: pr.html_url,
      repoName: pr.repoName,
      org: pr.orgLogin,
      status: pr.state,
      description: "",
    }));

    const allResults = [...commitResults, ...issueResults, ...prResults];

    res.status(200).json(allResults);
  } catch (error) {
    console.error("Global search failed:", error);
    res.status(500).json({ error: "Global search failed" });
  }
};

module.exports = { globalSearch };
