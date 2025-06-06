const axios = require('axios');
const Organization = require('../models/Organization');
const OrgUser = require('../models/OrgUser');
const Repository = require('../models/Repository');
const Issue = require('../models/Issue');
const PullRequest = require('../models/PullRequest');
const Commit = require('../models/Commit');

const GIT_BASE_API = "https://api.github.com";
async function fetchAndStoreOrganizations(token, githubId) {
  const orgs = (
    await axios.get(`${GIT_BASE_API}/user/orgs`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).data;

  for (const org of orgs) {
    await Organization.updateOne(
      { githubId: org.id },
      {
        githubId: org.id,
        login: org.login,
        description: org.description,
        avatar_url: org.avatar_url,
        url: org.url,
        userGithubId: githubId,
      },
      { upsert: true }
    );

    await fetchAndStoreMembers(org.login, token);
    await fetchAndStoreRepos(org.login, token, githubId);
  }
}

async function fetchAndStoreMembers(orgLogin, token) {
  const members = (
    await axios.get(`${GIT_BASE_API}/orgs/${orgLogin}/members`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).data;

  for (const member of members) {
    await OrgUser.updateOne(
      { githubId: member.id },
      {
        githubId: member.id,
        login: member.login,
        avatar_url: member.avatar_url,
        html_url: member.html_url,
        org: orgLogin,
      },
      { upsert: true }
    );
  }
}

async function fetchAndStoreRepos(orgLogin, token, githubId) {
  let page = 1;
  let allRepos = [];

  while (true) {
    const repos = (
      await axios.get(`${GIT_BASE_API}/orgs/${orgLogin}/repos`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { per_page: 100, page }
      })
    ).data;

    if (!repos.length) break;
    allRepos = allRepos.concat(repos);
    page++;
  }

  for (const repo of allRepos) {
    await Repository.updateOne(
      { githubId: repo.id },
      {
        githubId: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description,
        html_url: repo.html_url,
        private: repo.private,
        fork: repo.fork,
        created_at: repo.created_at,
        updated_at: repo.updated_at,
        pushed_at: repo.pushed_at,
        language: repo.language,
        organizationLogin: orgLogin,
        ownerLogin: repo.owner.login,
        userGithubId: githubId,
      },
      { upsert: true }
    );

    await Promise.all([
      fetchAndStoreIssues(orgLogin, repo.name, token),
      fetchAndStorePullRequests(orgLogin, repo.name, token, githubId),
      fetchAndStoreCommits(orgLogin, repo.name, token, githubId)
    ]);
  }
}

async function fetchAndStoreIssues(org, repo, token) {
  try {
    const issues = (
      await axios.get(`${GIT_BASE_API}/repos/${org}/${repo}/issues`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { state: 'all', per_page: 100 }
      })
    ).data;

    if (issues.length === 0) {
      await Issue.updateOne(
        { repository: repo, org, placeholder: true },
        { repository: repo, org, placeholder: true },
        { upsert: true }
      );
      return;
    }

    for (const issue of issues) {
      if (issue.pull_request) continue;

      await Issue.updateOne(
        { issueId: issue.id },
        {
          issueId: issue.id,
          title: issue.title,
          body: issue.body,
          state: issue.state,
          createdAt: issue.created_at,
          updatedAt: issue.updated_at,
          closedAt: issue.closed_at,
          repository: repo,
          org,
          user: issue.user,
          labels: issue.labels,
          comments: issue.comments,
          url: issue.html_url,
        },
        { upsert: true }
      );
    }
  } catch (err) {
    console.error(`Failed to fetch issues for ${org}/${repo}:`, err.message);
  }
}

async function fetchAndStorePullRequests(org, repo, token, githubId) {
  try {
    const pulls = (
      await axios.get(`${GIT_BASE_API}/repos/${org}/${repo}/pulls`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { state: 'all', per_page: 100 }
      })
    ).data;

    if (pulls.length === 0) {
      await PullRequest.updateOne(
        { repoName: repo, orgLogin: org, placeholder: true },
        {
          repoName: repo,
          orgLogin: org,
          placeholder: true,
          userGithubId: githubId,
        },
        { upsert: true }
      );
      return;
    }

    for (const pr of pulls) {
      await PullRequest.updateOne(
        { id: pr.id },
        {
          id: pr.id,
          number: pr.number,
          title: pr.title,
          state: pr.state,
          createdAt: pr.created_at,
          updatedAt: pr.updated_at,
          closedAt: pr.closed_at,
          mergedAt: pr.merged_at,
          userLogin: pr.user?.login,
          html_url: pr.html_url,
          repoName: repo,
          orgLogin: org,
          userGithubId: githubId,
          placeholder: false,
        },
        { upsert: true }
      );
    }
  } catch (err) {
    console.error(`Failed to fetch pull requests for ${org}/${repo}:`, err.message);
  }
}


async function fetchAndStoreCommits(org, repo, token, githubId) {
  const commits = (
    await axios.get(`${GIT_BASE_API}/repos/${org}/${repo}/commits`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).data;

  for (const commit of commits) {
    await Commit.updateOne(
      { sha: commit.sha },
      {
        sha: commit.sha,
        message: commit.commit.message,
        authorName: commit.commit.author?.name,
        authorEmail: commit.commit.author?.email,
        date: commit.commit.author?.date,
        html_url: commit.html_url,
        repoName: repo,
        orgLogin: org,
        userGithubId: githubId,
      },
      { upsert: true }
    );
  }
}

module.exports = {
  fetchAndStoreOrganizations,
};
