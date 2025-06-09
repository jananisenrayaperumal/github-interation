const Commit = require("../models/Commit");
const Issue = require("../models/Issue");
const PullRequest = require("../models/PullRequest");

const buildSearchConditions = (searchText) => {
    const regex = new RegExp(searchText, "i");
    const isNumber = !isNaN(searchText) && !isNaN(parseFloat(searchText));
    const numericSearch = isNumber ? parseInt(searchText, 10) : null;
    const isHash = searchText.length >= 6 && /^[a-f0-9]+$/i.test(searchText);
    const hashRegex = isHash ? new RegExp(`^${searchText}`, "i") : null;

    return { regex, numericSearch, hashRegex };
};

const buildCommitQuery = ({ regex, numericSearch, hashRegex }) => {
    const query = {
        $or: [
            // Text fields
            { message: regex },
            { authorName: regex },
            { authorEmail: regex },
            { committerName: regex },
            { committerEmail: regex },
            { repoName: regex },
            { orgLogin: regex },
            { branch: regex },
            { userGithubId: regex },
            { "tree.sha": regex },
            { "parents.sha": regex },
            { "author.login": regex },
            { "committer.login": regex },
        ],
    };

    // Add hash searches
    if (hashRegex) {
        query.$or.push(
            { sha: hashRegex },
            { "tree.sha": hashRegex },
            { "parents.sha": hashRegex }
        );
    }

    // Add numeric searches
    if (numericSearch !== null) {
        query.$or.push(
            { "author.id": numericSearch },
            { "committer.id": numericSearch }
        );
    }

    return query;
};

// Build issue search query
const buildIssueQuery = ({ regex, numericSearch }) => {
    const query = {
        $or: [
            // Text fields
            { title: regex },
            { body: regex },
            { "user.login": regex },
            { repository: regex },
            { org: regex },
            { state: regex },
            { sourceRepo: regex },
            { sourceType: regex },
            { parentRepo: regex },
            { url: regex },
            { reason: regex },
            { "assignees.login": regex },
            { "labels.name": regex },
            { "labels.description": regex },
            { "milestone.title": regex },
            { "milestone.description": regex },
        ],
    };

    // Add numeric searches
    if (numericSearch !== null) {
        query.$or.push(
            { issueId: numericSearch },
            { number: numericSearch },
            { comments: numericSearch },
            { totalFetched: numericSearch },
            { limitApplied: numericSearch },
            { "assignees.id": numericSearch },
            { "milestone.id": numericSearch },
          { "milestone.number": numericSearch },
          { "labels.name": numericSearch }
        );
    }

    return query;
};

// Build pull request search query
const buildPullRequestQuery = ({ regex, numericSearch, hashRegex }) => {
    const query = {
        $or: [
            // Text fields
            { title: regex },
            { body: regex },
            { userLogin: regex },
            { repoName: regex },
            { orgLogin: regex },
            { sourceRepo: regex },
            { mergedBy: regex },
            { state: regex },
            { sourceType: regex },
            { parentRepo: regex },
            { userGithubId: regex },
            { html_url: regex },
            { diff_url: regex },
            { patch_url: regex },
            { mergeCommitSha: regex },
            { assignees: regex },
            { requested_reviewers: regex },
            { "head.ref": regex },
            { "head.sha": regex },
            { "head.label": regex },
            { "base.ref": regex },
            { "base.sha": regex },
            { "base.label": regex },
        ],
    };

    // Add hash searches
    if (hashRegex) {
        query.$or.push(
            { mergeCommitSha: hashRegex },
            { "head.sha": hashRegex },
            { "base.sha": hashRegex }
        );
    }

    // Add numeric searches
    if (numericSearch !== null) {
        query.$or.push(
            { id: numericSearch },
            { number: numericSearch },
            { comments: numericSearch },
            { review_comments: numericSearch },
            { commits: numericSearch },
            { additions: numericSearch },
            { deletions: numericSearch },
            { changed_files: numericSearch },
            { limitApplied: numericSearch }
        );
    }

    return query;
};

// Transform results to consistent format
const transformResults = {
    commit: (commit) => ({
        type: "commit",
        id: commit.sha,
        title: commit.message,
        user: commit.authorName,
        date: commit.date,
        url: commit.html_url,
        repoName: commit.repoName,
        org: commit.orgLogin,
        status: "N/A",
        description: `${commit.sha?.substring(0, 7)} on ${commit.branch || 'unknown branch'}`,
        branch: commit.branch,
    }),

    issue: (issue) => ({
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
        number: issue.number,
    }),

    pullRequest: (pr) => ({
        type: "pull_request",
        id: pr.id,
        title: pr.title,
        user: pr.userLogin,
        date: pr.createdAt,
        url: pr.html_url,
        repoName: pr.repoName,
        org: pr.orgLogin,
        status: pr.state,
        description: pr.body || "",
        number: pr.number,
    }),
};

const globalSearch = async (req, res) => {
    const searchText = req.query.q;
    
    console.log("I am searching", searchText);

    if (!searchText) {
        return res.status(400).json({ error: "Search query is missing" });
    }

    try {
        const searchConditions = buildSearchConditions(searchText);

        const [commits, issues, prs] = await Promise.all([
            Commit.find(buildCommitQuery(searchConditions)).lean(),
            Issue.find(buildIssueQuery(searchConditions)).lean(),
            PullRequest.find(buildPullRequestQuery(searchConditions)).lean(),
        ]);

        // Transform results
        const allResults = [
            ...commits.map(transformResults.commit),
            ...issues.map(transformResults.issue),
            ...prs.map(transformResults.pullRequest),
        ];

        // Sort results by date (newest first)
        allResults.sort((a, b) => new Date(b.date) - new Date(a.date));

        res.status(200).json(allResults);
    } catch (error) {
        console.error("Global search failed:", error);
        res.status(500).json({ error: "Global search failed" });
    }
};

module.exports = { globalSearch };