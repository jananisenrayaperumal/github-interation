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
      if (!issue.id) {
        console.warn("Skipping issue with missing id:", issue);
        continue;
      }
    
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
  console.log(`Starting to fetch PRs for ${org}/${repo}`);
  
  try {
    // Step 1: Get repo info to check if it's a fork
    const repoInfo = await axios.get(`${GIT_BASE_API}/repos/${org}/${repo}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log(`Repo info: ${repoInfo.data.full_name}`);
    console.log(`Is fork: ${repoInfo.data.fork}`);

    let targetOrg = org;
    let targetRepo = repo;
    let sourceType = 'direct';

    // Step 2: If it's a fork, fetch PRs from parent repo instead
    if (repoInfo.data.fork && repoInfo.data.parent) {
      const parentInfo = repoInfo.data.parent;
      console.log(`Parent repo: ${parentInfo.full_name}`);
      console.log(`Fetching PRs from parent repo instead of fork`);
      
      targetOrg = parentInfo.owner.login;
      targetRepo = parentInfo.name;
      sourceType = 'parent';
    }

    // Step 3: Fetch PRs from target repo (either original or parent)
    const PR_LIMIT = 100;
    const allStates = ['open', 'closed', 'all'];
    const allPRs = new Map(); // Use Map to avoid duplicates by PR ID
    
    console.log(`Limiting to first ${PR_LIMIT} PRs`);
    
    for (const state of allStates) {
      if (allPRs.size >= PR_LIMIT) {
        console.log(`Reached PR limit of ${PR_LIMIT}, stopping fetch`);
        break;
      }
      
      console.log(`Fetching ${state} PRs for ${targetOrg}/${targetRepo}`);
      let page = 1;
      
      while (allPRs.size < PR_LIMIT) {
        console.log(`Fetching ${state} PRs - page ${page} (Current total: ${allPRs.size}/${PR_LIMIT})`);
        
        const { data: prs } = await axios.get(`${GIT_BASE_API}/repos/${targetOrg}/${targetRepo}/pulls`, {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            state: state,
            per_page: 100,
            page: page,
            sort: 'created',
            direction: 'desc'
          }
        });

        if (!prs || prs.length === 0) {
          console.log(`No more ${state} PRs on page ${page}`);
          break;
        }

        // Add to Map to avoid duplicates, but respect the limit
        let addedThisPage = 0;
        for (const pr of prs) {
          if (pr && pr.id && !allPRs.has(pr.id)) {
            if (allPRs.size >= PR_LIMIT) {
              console.log(`Reached PR limit of ${PR_LIMIT} while processing page ${page}`);
              break;
            }
            allPRs.set(pr.id, pr);
            addedThisPage++;
          }
        }

        console.log(`Added ${addedThisPage} new PRs from page ${page} (Total unique: ${allPRs.size}/${PR_LIMIT})`);
        
        if (allPRs.size >= PR_LIMIT) {
          console.log(`Successfully reached PR limit of ${PR_LIMIT}`);
          break;
        }
        
        page++;
      }
    }

    console.log(`Total unique PRs found: ${allPRs.size} (Limited to ${PR_LIMIT})`);

    if (allPRs.size === 0) {
      console.log(`No PRs found, creating placeholder for ${org}/${repo}`);
      await PullRequest.updateOne(
        { repoName: repo, orgLogin: org, placeholder: true },
        { 
          repoName: repo, 
          orgLogin: org, 
          placeholder: true, 
          userGithubId: githubId,
          sourceType: sourceType,
          sourceRepo: `${targetOrg}/${targetRepo}`,
          parentRepo: repoInfo.data.parent?.full_name || null,
          limitApplied: PR_LIMIT
        },
        { upsert: true }
      );
      return;
    }

    // Step 4: Process and store each unique PR
    let processedCount = 0;
    for (const [prId, prDetails] of allPRs) {
      try {
        // Get additional details for merged PRs
        let mergeCommitSha = null;
        if (prDetails.merged_at && prDetails.merge_commit_sha) {
          mergeCommitSha = prDetails.merge_commit_sha;
        }

        await PullRequest.updateOne(
          { id: prDetails.id },
          {
            id: prDetails.id,
            number: prDetails.number,
            title: prDetails.title,
            body: prDetails.body || '',
            state: prDetails.state,
            createdAt: prDetails.created_at,
            updatedAt: prDetails.updated_at,
            closedAt: prDetails.closed_at,
            mergedAt: prDetails.merged_at,
            merged: prDetails.merged || false,
            mergeable: prDetails.mergeable,
            mergeCommitSha: mergeCommitSha,
            userLogin: prDetails.user?.login,
            html_url: prDetails.html_url,
            diff_url: prDetails.diff_url,
            patch_url: prDetails.patch_url,
            // Store original fork info + source info
            repoName: repo, // Original fork repo name
            orgLogin: org, // Original fork org
            sourceRepo: `${targetOrg}/${targetRepo}`, // Where PR actually came from
            sourceType: sourceType, // 'direct' or 'parent'
            parentRepo: repoInfo.data.parent?.full_name || null,
            userGithubId: githubId,
            placeholder: false,
            assignees: prDetails.assignees?.map((a) => a.login) || [],
            requested_reviewers: prDetails.requested_reviewers?.map((r) => r.login) || [],
            mergedBy: prDetails.merged_by?.login || null,
            draft: prDetails.draft || false,
            locked: prDetails.locked || false,
            // Additional useful fields
            head: {
              ref: prDetails.head?.ref,
              sha: prDetails.head?.sha,
              label: prDetails.head?.label
            },
            base: {
              ref: prDetails.base?.ref,
              sha: prDetails.base?.sha,
              label: prDetails.base?.label
            },
            comments: prDetails.comments || 0,
            review_comments: prDetails.review_comments || 0,
            commits: prDetails.commits || 0,
            additions: prDetails.additions || 0,
            deletions: prDetails.deletions || 0,
            changed_files: prDetails.changed_files || 0
          },
          { upsert: true }
        );

        processedCount++;
        
        if (processedCount % 50 === 0) {
          console.log(`Processed ${processedCount}/${allPRs.size} PRs`);
        }

      } catch (prError) {
        console.error(`Error processing PR ${prDetails.number}:`, prError.message);
      }
    }

    console.log(`Successfully processed ${processedCount} PRs for ${org}/${repo}`);

    // Log summary by state
    const summary = {
      open: Array.from(allPRs.values()).filter(pr => pr.state === 'open').length,
      closed: Array.from(allPRs.values()).filter(pr => pr.state === 'closed' && !pr.merged_at).length,
      merged: Array.from(allPRs.values()).filter(pr => pr.merged_at).length,
      sourceType: sourceType,
      sourceRepo: `${targetOrg}/${targetRepo}`,
      parentRepo: repoInfo.data.parent?.full_name || null,
      totalFetched: allPRs.size,
      limitApplied: PR_LIMIT
    };
    
    console.log(`PR Summary for ${org}/${repo}:`, summary);

  } catch (err) {
    console.error(`Failed to fetch pull requests for ${org}/${repo}:`, err.message);
    console.error('Error details:', err.response?.data || err);
  }
}

async function fetchAndStoreCommits(org, repo, token, githubId) {
  let totalCommits = 0;

  // Step 1: Get all branches
  const branches = (
    await axios.get(`${GIT_BASE_API}/repos/${org}/${repo}/branches`, {
      headers: { Authorization: `Bearer ${token}` }
    })
  ).data;

  // Step 2: Loop through each branch
  for (const branch of branches) {
    let page = 1;

    while (true) {
      const commits = (
        await axios.get(`${GIT_BASE_API}/repos/${org}/${repo}/commits`, {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            sha: branch.name,       // important: target branch
            per_page: 100,
            page,
            since: "2000-01-01T00:00:00Z"
          }
        })
      ).data;

      if (!commits.length) break;

      for (const commit of commits) {
        if (!commit?.sha) continue;

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
            branch: branch.name  // optional: for better tracking
          },
          { upsert: true }
        );

        totalCommits++;
      }

      page++;
    }
  }

  console.log(`Total commits fetched for ${org}/${repo}: ${totalCommits}`);
}


module.exports = {
  fetchAndStoreOrganizations,
};
