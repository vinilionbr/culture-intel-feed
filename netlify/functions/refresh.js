// Netlify Function: triggers the "Culture Scout Refresh" GitHub Actions workflow.
// The GitHub token lives only here (as a Netlify env var), never in the public page.
//
// Requires a Netlify environment variable:
//   GH_DISPATCH_TOKEN  — a GitHub fine-grained PAT with "Actions: Read and write"
//                        permission on the culture-intel-feed repo.

const OWNER = 'vinilionbr';
const REPO  = 'culture-intel-feed';
const WORKFLOW = 'daily-signals.yml';
const COOLDOWN_MS = 8 * 60 * 1000; // don't allow a manual run within 8 min of the last one

const gh = (path, token, init = {}) =>
  fetch(`https://api.github.com/repos/${OWNER}/${REPO}${path}`, {
    ...init,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'culture-scout-dashboard',
      ...(init.headers || {}),
    },
  });

const reply = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const handler = async () => {
  const token = process.env.GH_DISPATCH_TOKEN;
  if (!token) {
    return reply(500, { status: 'error', message: 'Server is missing GH_DISPATCH_TOKEN.' });
  }

  try {
    // Guard: refuse if a run is already going or one started very recently.
    const runsRes = await gh(`/actions/workflows/${WORKFLOW}/runs?per_page=1`, token);
    if (runsRes.ok) {
      const { workflow_runs = [] } = await runsRes.json();
      const latest = workflow_runs[0];
      if (latest && (latest.status === 'queued' || latest.status === 'in_progress')) {
        return reply(200, { status: 'busy', message: 'A refresh is already running. Give it a few minutes.' });
      }
      if (latest && Date.now() - new Date(latest.created_at).getTime() < COOLDOWN_MS) {
        return reply(200, { status: 'cooldown', message: 'Just refreshed moments ago. Try again in a few minutes.' });
      }
    }

    // Trigger the workflow.
    const dispatch = await gh(`/actions/workflows/${WORKFLOW}/dispatches`, token, {
      method: 'POST',
      body: JSON.stringify({ ref: 'main' }),
    });

    if (dispatch.status === 204) {
      return reply(200, { status: 'triggered', message: 'Refreshing. New signals land in a few minutes.' });
    }
    const detail = await dispatch.text().catch(() => '');
    return reply(502, { status: 'error', message: `GitHub rejected the trigger (${dispatch.status}). ${detail.slice(0, 120)}` });
  } catch (err) {
    return reply(502, { status: 'error', message: `Could not reach GitHub: ${err.message}` });
  }
};
