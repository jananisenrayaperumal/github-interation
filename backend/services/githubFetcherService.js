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
  const ISSUE_LIMIT = 10;
  let totalIssues = 0;
  let page = 1;
  let allIssues = [];

  try {
    console.log(`Starting to fetch issues for ${org}/${repo} (limit: ${ISSUE_LIMIT})`);

    // Step 1: Get repo info to check if it's a fork and has issues enabled
    const repoInfo = await axios.get(`${GIT_BASE_API}/repos/${org}/${repo}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log(`Repo info: ${repoInfo.data.full_name}`);
    console.log(`Is fork: ${repoInfo.data.fork}`);
    console.log(`Has issues: ${repoInfo.data.has_issues}`);

    let targetOrg = org;
    let targetRepo = repo;
    let sourceType = 'direct';

    // Step 2: If it's a fork, check if we should fetch from parent repo
    if (repoInfo.data.fork && repoInfo.data.parent) {
      const parentInfo = repoInfo.data.parent;
      console.log(`Parent repo: ${parentInfo.full_name}`);
      console.log(`Parent has issues: ${parentInfo.has_issues}`);
      
      // If current fork doesn't have issues but parent does, fetch from parent
      if (!repoInfo.data.has_issues && parentInfo.has_issues) {
        console.log(`Fork has no issues, fetching from parent repo instead`);
        targetOrg = parentInfo.owner.login;
        targetRepo = parentInfo.name;
        sourceType = 'parent';
      } else if (repoInfo.data.has_issues) {
        console.log(`Fork has its own issues enabled, fetching from fork`);
      } else {
        console.log(`Neither fork nor parent has issues enabled`);
      }
    } else if (!repoInfo.data.has_issues) {
      console.log(`Repository has issues disabled`);
    }

    // Step 3: Check if target repo has issues enabled
    if (sourceType === 'parent') {
      // Already checked parent has issues
    } else if (!repoInfo.data.has_issues) {
      console.log(`No issues to fetch for ${org}/${repo} - issues disabled`);
      await Issue.updateOne(
        { repository: repo, org, placeholder: true },
        { 
          repository: repo, 
          org, 
          placeholder: true,
          totalFetched: 0,
          limitApplied: ISSUE_LIMIT,
          reason: 'issues_disabled',
          sourceType: sourceType,
          sourceRepo: `${targetOrg}/${targetRepo}`
        },
        { upsert: true }
      );
      return;
    }

    // Step 4: Fetch issues from target repo (either original or parent)
    console.log(`Fetching issues from ${targetOrg}/${targetRepo} (source: ${sourceType})`);

    while (totalIssues < ISSUE_LIMIT) {
      const remainingIssues = ISSUE_LIMIT - totalIssues;
      const perPage = Math.min(100, remainingIssues);

      console.log(`Fetching issues page ${page} (${totalIssues}/${ISSUE_LIMIT} fetched so far)`);

      const response = await axios.get(`${GIT_BASE_API}/repos/${targetOrg}/${targetRepo}/issues`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { 
          state: 'all', 
          per_page: perPage,
          page: page,
          sort: 'created',
          direction: 'desc'
        }
      });

      const issues = response.data;

      // Break if no more issues
      if (!issues.length) {
        console.log(`No more issues found on page ${page}`);
        break;
      }

      // Filter out pull requests
      const actualIssues = issues.filter(issue => !issue.pull_request);
      const prCount = issues.length - actualIssues.length;
      
      allIssues = allIssues.concat(actualIssues);
      totalIssues += actualIssues.length;
      
      console.log(`Found ${actualIssues.length} actual issues on page ${page} (${prCount} were PRs)`);

      // Break if we've reached the limit
      if (totalIssues >= ISSUE_LIMIT) {
        console.log(`Reached issue limit of ${ISSUE_LIMIT}`);
        break;
      }

      // If we got less than requested per_page, likely no more pages
      if (issues.length < perPage) {
        console.log(`Got ${issues.length} items, less than requested ${perPage}. Likely last page.`);
        break;
      }

      page++;
    }

    console.log(`Total issues fetched for ${org}/${repo}: ${allIssues.length}`);

    // Handle case where no issues are found
    if (allIssues.length === 0) {
      console.log(`No issues found for ${org}/${repo}, creating placeholder`);
      await Issue.updateOne(
        { repository: repo, org, placeholder: true },
        { 
          repository: repo, 
          org, 
          placeholder: true,
          totalFetched: 0,
          limitApplied: ISSUE_LIMIT,
          reason: 'no_issues_found',
          sourceType: sourceType,
          sourceRepo: `${targetOrg}/${targetRepo}`,
          parentRepo: repoInfo.data.parent?.full_name || null
        },
        { upsert: true }
      );
      return;
    }

    // Step 5: Store all issues
    let processedCount = 0;
    for (const issue of allIssues) {
      if (!issue.id) {
        console.warn("Skipping issue with missing id:", issue.title || 'Unknown');
        continue;
      }
    
      await Issue.updateOne(
        { issueId: issue.id },
        {
          issueId: issue.id,
          number: issue.number,
          title: issue.title,
          body: issue.body,
          state: issue.state,
          createdAt: issue.created_at,
          updatedAt: issue.updated_at,
          closedAt: issue.closed_at,
          repository: repo, // Original fork repo name
          org, // Original fork org
          sourceRepo: `${targetOrg}/${targetRepo}`, // Where issues actually came from
          sourceType: sourceType, // 'direct' or 'parent'
          parentRepo: repoInfo.data.parent?.full_name || null,
          user: issue.user,
          assignees: issue.assignees || [],
          labels: issue.labels,
          comments: issue.comments,
          url: issue.html_url,
          locked: issue.locked || false,
          milestone: issue.milestone,
          placeholder: false
        },
        { upsert: true }
      );

      processedCount++;
      
      if (processedCount % 50 === 0) {
        console.log(`Processed ${processedCount}/${allIssues.length} issues`);
      }
    }

    console.log(`Successfully processed ${processedCount} issues for ${org}/${repo}`);

    // Log summary by state
    const summary = {
      open: allIssues.filter(issue => issue.state === 'open').length,
      closed: allIssues.filter(issue => issue.state === 'closed').length,
      totalFetched: allIssues.length,
      limitApplied: ISSUE_LIMIT,
      sourceType: sourceType,
      sourceRepo: `${targetOrg}/${targetRepo}`,
      parentRepo: repoInfo.data.parent?.full_name || null
    };
    
    console.log(`Issue Summary for ${org}/${repo}:`, summary);
    
  } catch (err) {
    console.error(`Failed to fetch issues for ${org}/${repo}:`, err.message);
    
    if (err.response?.status === 403) {
      console.error('Rate limit exceeded or insufficient permissions');
    } else if (err.response?.status === 404) {
      console.error('Repository not found or not accessible');
    } else if (err.response?.status === 410) {
      console.error('Issues are disabled for this repository');
    }
    
    console.error('Error details:', {
      status: err.response?.status,
      statusText: err.response?.statusText
    });
  }
}

async function fetchAndStorePullRequests(org, repo, token, githubId) {
  
  try {
    // Step 1: Get repo info to check if it's a fork
    const repoInfo = await axios.get(`${GIT_BASE_API}/repos/${org}/${repo}`, {
      headers: { Authorization: `Bearer ${token}` }
    });


    let targetOrg = org;
    let targetRepo = repo;
    let sourceType = 'direct';

    // Step 2: If it's a fork, fetch PRs from parent repo instead
    if (repoInfo.data.fork && repoInfo.data.parent) {
      const parentInfo = repoInfo.data.parent;
      
      targetOrg = parentInfo.owner.login;
      targetRepo = parentInfo.name;
      sourceType = 'parent';
    }

    // Step 3: Fetch PRs from target repo (either original or parent)
    const PR_LIMIT = 10;
    const allStates = ['open', 'closed', 'all'];
    const allPRs = new Map(); // Use Map to avoid duplicates by PR ID
    
    
    for (const state of allStates) {
      if (allPRs.size >= PR_LIMIT) {
        break;
      }
      
      let page = 1;
      
      while (allPRs.size < PR_LIMIT) {
        
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
          break;
        }

        // Add to Map to avoid duplicates, but respect the limit
        let addedThisPage = 0;
        for (const pr of prs) {
          if (pr && pr.id && !allPRs.has(pr.id)) {
            if (allPRs.size >= PR_LIMIT) {
              break;
            }
            allPRs.set(pr.id, pr);
            addedThisPage++;
          }
        }

        
        if (allPRs.size >= PR_LIMIT) {
          break;
        }
        
        page++;
      }
    }


    if (allPRs.size === 0) {
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
    

  } catch (err) {
    console.error(`Failed to fetch pull requests for ${org}/${repo}:`, err.message);
    console.error('Error details:', err.response?.data || err);
  }
}

async function fetchAndStoreCommits(org, repo, token, githubId) {
  const COMMIT_LIMIT_PER_BRANCH = 100;
  let totalCommits = 0;

  try {
    // Step 1: Get all branches
    const branches = (
      await axios.get(`${GIT_BASE_API}/repos/${org}/${repo}/branches`, {
        headers: { Authorization: `Bearer ${token}` }
      })
    ).data;

    // Step 2: Loop through each branch
    for (const branch of branches) {
      let branchCommits = 0;
      let page = 1;

      while (branchCommits < COMMIT_LIMIT_PER_BRANCH) {
        const remainingCommits = COMMIT_LIMIT_PER_BRANCH - branchCommits;
        const perPage = Math.min(100, remainingCommits);

        const commits = (
          await axios.get(`${GIT_BASE_API}/repos/${org}/${repo}/commits`, {
            headers: { Authorization: `Bearer ${token}` },
            params: {
              sha: branch.name,
              per_page: perPage,
              page,
              since: "2000-01-01T00:00:00Z"
            }
          })
        ).data;

        // Break if no more commits available
        if (!commits.length) {
          break;
        }

        // Process commits
        for (const commit of commits) {
          if (!commit?.sha) continue;
          await Commit.updateOne(
            { sha: commit.sha },
            {
              sha: commit.sha,
              message: commit.commit?.message,
              authorName: commit.commit?.author?.name,
              authorEmail: commit.commit?.author?.email,
              date: commit.commit?.author?.date,
              html_url: commit.html_url,
              repoName: repo,
              orgLogin: org,
              userGithubId: githubId,
              branch: branch?.name,
              committerName: commit.commit?.committer?.name,
              committerEmail: commit.commit?.committer?.email,
              committerDate: commit.commit?.committer?.date,
              stats: commitDetails?.stats || {},
              verified: commitDetails?.commit?.verification?.verified || false,
              tree: commitDetails?.commit?.tree,
              parents: commitDetails?.parents || [],
              author: {
                login: commitDetails?.author?.login,
                id: commitDetails?.author?.id,
                avatar_url: commitDetails?.author?.avatar_url,
                html_url: commitDetails?.author?.html_url
              },
              committer: {
                login: commitDetails?.committer?.login,
                id: commitDetails?.committer?.id,
                avatar_url: commitDetails?.committer?.avatar_url,
                html_url: commitDetails?.committer?.html_url
              }
            },
            { upsert: true }
          );

          branchCommits++;
          totalCommits++;

          // Break if we've reached the limit for this branch
          if (branchCommits >= COMMIT_LIMIT_PER_BRANCH) {
            break;
          }
        }

        page++;
      }

    }


  } catch (err) {
    console.error(`Failed to fetch commits for ${org}/${repo}:`, err.message);
    // Optionally log more details for debugging
    if (err.response?.status === 403) {
      console.error('Rate limit or permission issue - consider adding delay');
    }
  }
}


module.exports = {
  fetchAndStoreOrganizations,
  fetchAndStoreMembers,
  fetchAndStoreIssues,
  fetchAndStorePullRequests,
  fetchAndStoreCommits
};
