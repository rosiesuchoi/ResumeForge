# Resume Forge

Upload any resume PDF → get an ATS-optimized **Jake's Resume** (LaTeX, one click into Overleaf) with every bullet rewritten in **Google's XYZ format**, tailored to the job link you paste. It also pulls **live software engineering jobs** from the SimplifyJobs GitHub repos, scores your resume against each one, and has an **AI coach** that suggests improvements and company-specific LeetCode problems.

## Features

| Step | What it does |
| --- | --- |
| **1. Resume** | Drag in a PDF (any layout). Claude reads it (including hidden hyperlinks) and maps it onto the Jake's Resume sections. You can fix anything in the editor, with a live preview. |
| **2. Target job** | Paste a job link (Greenhouse, Lever, Ashby, Workday, SmartRecruiters, or any page with schema.org `JobPosting` data) or paste the description. The AI pulls out required and preferred skills plus other ATS keywords, and shows which ones your resume already has. |
| **3. Tailored resume** | Rewrites bullets as *"Accomplished [X] as measured by [Y], by doing [Z]"*, works in the job's exact keywords **only where your experience supports them**, and reorders skills. Shows the ATS score before and after (it updates live as you edit), a diff of every change, and honest advice for the keywords you're still missing. Export with **Open in Overleaf**, **Download .tex**, or **Copy LaTeX**. |
| **4. Job board** | Live new-grad and internship SWE listings from [SimplifyJobs/New-Grad-Positions](https://github.com/SimplifyJobs/New-Grad-Positions) and [SimplifyJobs/Summer2027-Internships](https://github.com/SimplifyJobs/Summer2027-Internships). Each one gets an instant **Est. fit %**. **Scan** fetches the real posting and computes an **ATS match %** without calling the AI, so it's fast and free. **Tailor** sends that job to step 2, and **Prep** opens the coach for that company. |
| **5. AI coach** | A prioritized resume review, ATS tips, what the company's interview loop usually looks like, 8–10 LeetCode problems (marked *Reported* when candidates commonly report them for that company), and a follow-up chat. |

### Truthfulness by design
The AI is told never to invent employers, technologies, or numbers. If a bullet has no metric, it adds a highlighted placeholder like `[X%]` or `[N users]` for you to fill in. The app warns you until every placeholder is filled.

## Setup

Requires **Node.js 20+** and an **Anthropic API key** (https://platform.claude.com → API keys).

```bash
cd resume-forge
npm install
cp .env.example .env.local     # then paste your key into .env.local
npm run dev                    # http://localhost:3000
```

`.env.local`:
```
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-5-5   # optional; claude-opus-5-5 gives the best rewrites
```

Optional: set `INTERNSHIP_REPO=SimplifyJobs/Summer2028-Internships` when the next internship cycle's repo goes live.

### Deploy (Vercel)
Push to GitHub → import the repo at vercel.com → add `ANTHROPIC_API_KEY` under Environment Variables → deploy. The tailoring route can run up to 180 s (`maxDuration`). Vercel's Hobby plan allows that with Fluid compute, which is on by default.

## How scoring works

- **ATS match (job tab, tailored tab, Scan button):** a weighted keyword match. Required skills count 3×, preferred 1.5×, and other keywords 1×. Matching understands tech names, so `C` won't match `C++`, `Java` won't match `JavaScript`, `Postgres` = `PostgreSQL`, and `continuous integration` = `CI/CD`. See `lib/keywords.ts`.
- **Est. fit (job board):** uses only the job title and category, which is all the GitHub list provides. It compares your skills with what that kind of role usually needs (frontend, backend, ML, mobile, embedded, infra, …) and lowers the score for senior titles or PhD-only roles. Use **Scan** for the real number.

## Project structure

```
app/
  page.tsx, layout.tsx, globals.css
  api/parse-resume   PDF → structured resume (Claude reads the PDF directly + extracted links)
  api/analyze-job    job URL/text → skills & ATS keywords
  api/tailor         resume + job → XYZ-rewritten, keyword-tailored resume + ATS before/after
  api/jobs           live SimplifyJobs listings (cached 30 min) + quick fit scores
  api/job-score      fetch one posting → deterministic ATS match
  api/coach          resume review + interview / LeetCode plan
  api/coach/chat     streaming follow-up chat
components/          Workspace (tabs/state), UploadPanel, JobPanel, TailorPanel, JobBoard, CoachPanel,
                     ResumeEditor, ResumePreview, ui
lib/
  latex.ts           Jake's Resume template generator + LaTeX escaping (runs in the browser too)
  keywords.ts        skill taxonomy, matcher, ATS + fit scoring
  jobFetch.ts        Greenhouse / Lever / Ashby / Workday / SmartRecruiters / JSON-LD / HTML readers
  jobsBoard.ts       SimplifyJobs listings loader
  claude.ts          Anthropic client + structured-output helper
  prompts.ts         all system prompts
  types.ts           zod schemas (also used as the AI's output schemas)
```

## Notes & limits
- Some career sites (iCIMS, Oracle, Eightfold, …) build the job description with JavaScript, so it can't be read automatically. When that happens the app asks you to paste the description.
- Your data is kept in your browser's localStorage and is sent only to your own server and the Anthropic API.
- LeetCode suggestions come from what the model knows about commonly reported problems. Treat them as practice targets, not a leaked question list.

## Credits
- Resume template: [Jake's Resume](https://github.com/jakegut/resume) by Jake Gutierrez (MIT), based on [sb2nov/resume](https://github.com/sb2nov/resume).
- Job data: [SimplifyJobs](https://github.com/SimplifyJobs) community lists.
- XYZ formula: Laszlo Bock, Google.
