import * as z from "zod/v4";

/* ---------- Resume (maps 1:1 onto Jake's Resume sections) ---------- */

export const LinkSchema = z.object({
  label: z.string().describe("Display text, e.g. 'linkedin.com/in/jane' or 'github.com/jane'"),
  url: z.string().describe("Full URL including https://"),
});

export const EducationSchema = z.object({
  school: z.string(),
  location: z.string(),
  degree: z.string().describe("e.g. 'Bachelor of Science in Computer Science, Minor in Math'"),
  dates: z.string().describe("e.g. 'Sep. 2022 -- Jun. 2026' (use -- for ranges)"),
  details: z
    .array(z.string())
    .describe("Optional lines such as 'GPA: 3.8/4.0' or 'Relevant Coursework: ...'. Empty array if none."),
});

export const ExperienceSchema = z.object({
  title: z.string().describe("Role title, e.g. 'Software Engineer Intern'"),
  company: z.string(),
  location: z.string(),
  dates: z.string(),
  bullets: z.array(z.string()),
});

export const ProjectSchema = z.object({
  name: z.string(),
  tech: z.string().describe("Comma separated technologies, e.g. 'React, Node.js, PostgreSQL'"),
  dates: z.string().describe("Empty string if unknown"),
  link: z.string().describe("Project URL or empty string"),
  bullets: z.array(z.string()),
});

export const SkillGroupSchema = z.object({
  category: z.string().describe("e.g. 'Languages', 'Frameworks', 'Developer Tools', 'Libraries'"),
  items: z.string().describe("Comma separated list"),
});

export const ResumeSchema = z.object({
  name: z.string(),
  phone: z.string(),
  email: z.string(),
  location: z.string().describe("City, State or empty string"),
  links: z.array(LinkSchema),
  education: z.array(EducationSchema),
  experience: z.array(ExperienceSchema),
  projects: z.array(ProjectSchema),
  leadership: z
    .array(ExperienceSchema)
    .describe("Leadership, activities, volunteering, research groups. Empty array if none."),
  skills: z.array(SkillGroupSchema),
  certifications: z.array(z.string()).describe("Certifications/awards, one per entry. Empty array if none."),
});

export type Resume = z.infer<typeof ResumeSchema>;
export type Experience = z.infer<typeof ExperienceSchema>;
export type Project = z.infer<typeof ProjectSchema>;

/* ---------- Job analysis ---------- */

export const JobAnalysisSchema = z.object({
  title: z.string(),
  company: z.string(),
  location: z.string(),
  level: z.string().describe("Intern, New Grad, Entry, Mid, Senior, etc."),
  summary: z.string().describe("2-3 sentence plain-English summary of the role"),
  requiredSkills: z
    .array(z.string())
    .describe("Hard skills/technologies explicitly required, in the exact wording the posting uses"),
  preferredSkills: z.array(z.string()).describe("Nice-to-have / preferred / bonus skills"),
  keywords: z
    .array(z.string())
    .describe(
      "Other ATS keywords and phrases: domain terms, methodologies, responsibilities, soft skills (e.g. 'distributed systems', 'cross-functional', 'code reviews')",
    ),
  responsibilities: z.array(z.string()).describe("Top 4-6 responsibilities, short phrases"),
});
export type JobAnalysis = z.infer<typeof JobAnalysisSchema>;

export type JobPosting = {
  url: string;
  source: string; // greenhouse, lever, ashby, workday, jsonld, html, pasted
  title: string;
  company: string;
  location: string;
  text: string;
};

/* ---------- Tailoring ---------- */

export const TailorResultSchema = z.object({
  resume: ResumeSchema,
  changes: z.array(
    z.object({
      section: z.string().describe("e.g. 'Experience: Software Engineer Intern @ Acme' or 'Skills'"),
      before: z.string().describe("Original text (empty string if this is a new line)"),
      after: z.string(),
      reason: z.string().describe("One short sentence: which keyword(s) or XYZ element this adds"),
    }),
  ),
  keywordsUsed: z.array(z.string()).describe("Job keywords now present in the tailored resume"),
  missingKeywords: z
    .array(
      z.object({
        keyword: z.string(),
        advice: z
          .string()
          .describe("How the candidate could truthfully earn or show this (course, project, cert), one sentence"),
      }),
    )
    .describe("Important job keywords the candidate's real experience does not support"),
  notes: z.string().describe("1-3 sentences of overall notes for the candidate"),
});
export type TailorResult = z.infer<typeof TailorResultSchema>;

/* ---------- Coach ---------- */

export const CoachHighlightSchema = z.object({
  id: z
    .string()
    .describe("Line id exactly as shown in the indexed resume, e.g. 'experience.0.bullets.2' or 'skills.1'"),
  kind: z.enum(["weak", "strong"]).describe("'weak' = weakest area (yellow), 'strong' = strongest area (green)"),
  reason: z.string().describe("One short sentence on why this line is weak or strong"),
});

export const CoachReportSchema = z.object({
  overall: z.string().describe("2-4 sentence honest overall assessment"),
  highlights: z
    .array(CoachHighlightSchema)
    .describe("2-3 weakest lines and 1-2 strongest lines of the resume, each referenced by line id"),
  strengths: z.array(z.string()),
  improvements: z.array(
    z.object({
      title: z.string(),
      detail: z.string(),
      example: z.string().describe("Concrete example rewrite or action; empty string if not applicable"),
      priority: z.enum(["high", "medium", "low"]),
    }),
  ),
  atsTips: z.array(z.string()),
  interview: z.object({
    company: z.string(),
    process: z.string().describe("What this company's SWE interview loop typically looks like, 2-3 sentences"),
    leetcode: z.array(
      z.object({
        title: z.string().describe("Exact LeetCode problem title"),
        slug: z.string().describe("LeetCode URL slug, e.g. 'two-sum'"),
        difficulty: z.enum(["Easy", "Medium", "Hard"]),
        topic: z.string().describe("e.g. 'Sliding Window', 'Graphs / BFS'"),
        why: z.string().describe("Why it's relevant for this company/role, one sentence"),
        source: z
          .enum(["company-reported", "general-practice"])
          .describe(
            "'company-reported' only if this problem is widely reported by candidates for this company; otherwise 'general-practice'",
          ),
      }),
    ),
    otherTips: z.array(z.string()).describe("Behavioral / system design / OA tips for this company"),
  }),
});
export type CoachReport = z.infer<typeof CoachReportSchema>;

/** A coach highlight as the browser stores it: `text` snapshots the line so the mark drops off once that line is edited. */
export type CoachHighlight = z.infer<typeof CoachHighlightSchema> & { text: string };
export type CoachReportView = Omit<CoachReport, "highlights"> & { highlights: CoachHighlight[] };

/** The follow-up chat returns a reply plus optional edits the app applies to the resume. */
export const ChatReplySchema = z.object({
  reply: z.string().describe("Markdown reply to the candidate, under ~200 words"),
  edits: z
    .array(
      z.object({
        id: z.string().describe("Line id from the indexed resume"),
        after: z.string().describe("The complete new text of that one line"),
        reason: z.string().describe("One short phrase: what improved"),
      }),
    )
    .describe("Resume lines to rewrite. Empty array unless the candidate asked to improve/change the resume."),
});
export type ChatEdit = { id: string; section: string; before: string; after: string; reason: string };
export type ChatResponse = { reply: string; edits: ChatEdit[] };

/* ---------- Job board ---------- */

export type BoardJob = {
  id: string;
  list: "newgrad" | "intern";
  company: string;
  title: string;
  url: string;
  locations: string[];
  category: string;
  datePosted: number; // unix seconds
  sponsorship: string;
  degrees: string[];
  terms?: string[];
};

export type ScoredBoardJob = BoardJob & {
  fit: number; // 0-100 quick estimated fit
  fitMatched: string[];
  fitMissing: string[];
};

export type AtsResult = {
  score: number;
  matched: string[];
  missing: string[];
  total: number;
};

export function emptyResume(): Resume {
  return {
    name: "",
    phone: "",
    email: "",
    location: "",
    links: [],
    education: [],
    experience: [],
    projects: [],
    leadership: [],
    skills: [],
    certifications: [],
  };
}
