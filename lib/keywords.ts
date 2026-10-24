import type { AtsResult, JobAnalysis } from "./types";

/**
 * Skill taxonomy used for deterministic ATS-style keyword matching.
 * Each entry: canonical name + aliases. Aliases are matched case-insensitively
 * with tech-aware word boundaries unless `cs` (case-sensitive) is set.
 */
type Term = { name: string; aliases?: string[]; cs?: boolean; group: string };

type Entry = string | [string] | [string, string[]] | [string, string[], true];
const T = (group: string, list: Entry[]): Term[] =>
  list.map((x) =>
    typeof x === "string" ? { name: x, group } : { name: x[0], aliases: x[1] ?? [], cs: x[2] === true, group },
  );

export const TAXONOMY: Term[] = [
  ...T("Languages", [
    "Python", "Java", "JavaScript", ["TypeScript", ["ts"]], ["C++", ["cpp", "c plus plus"]], ["C#", ["csharp", "c sharp"]],
    ["C", ["C"], true], ["Go", ["Golang", "Go"], true], "Rust", "Kotlin", "Swift", "Objective-C", "Ruby", "PHP", "Scala",
    ["R", ["R"], true], "MATLAB", "Perl", "Haskell", "Elixir", "Dart", "Lua", "Julia", ["Bash", ["shell scripting", "shell"]],
    "PowerShell", ["SQL", ["PostgreSQL", "MySQL", "SQLite", "T-SQL", "PL/SQL"]], "HTML", "CSS", ["Sass", ["scss"]], "Solidity", "Verilog", "VHDL", "Assembly", "Fortran", "COBOL",
  ]),
  ...T("Frontend", [
    ["React", ["React.js", "ReactJS"]], ["Next.js", ["nextjs"]], ["Angular", ["AngularJS"]], ["Vue", ["Vue.js", "vuejs"]],
    "Svelte", "Redux", ["Tailwind CSS", ["tailwind"]], "Bootstrap", "jQuery", "Webpack", "Vite", ["React Native"],
    "Flutter", "SwiftUI", "Jetpack Compose", "Three.js", "D3.js", ["Material UI", ["MUI", "Material-UI"]],
  ]),
  ...T("Backend", [
    ["Node.js", ["node", "nodejs"]], ["Express.js", ["express.js", "expressjs"]], "Django", "Flask", "FastAPI",
    ["Spring Boot", ["spring framework"]], ["Ruby on Rails", ["rails"]], [".NET", ["dotnet", "asp.net", ".net core"]],
    "GraphQL", ["REST APIs", ["REST", "RESTful", "REST API", "RESTful APIs"]], "gRPC", ["Microservices", ["microservice"]],
    "Kafka", "RabbitMQ", "Redis", ["WebSockets", ["websocket"]], "Laravel", "NestJS",
  ]),
  ...T("Data & ML", [
    ["Machine Learning", ["ML"]], ["Deep Learning"], ["Artificial Intelligence", ["AI"]], ["PyTorch"], ["TensorFlow"],
    "Keras", ["scikit-learn", ["sklearn", "scikit learn"]], "Pandas", "NumPy", ["Spark", ["Apache Spark", "PySpark"]],
    "Hadoop", "Airflow", "dbt", ["LLMs", ["LLM", "large language models", "large language model"]],
    ["NLP", ["natural language processing"]], ["Computer Vision", ["OpenCV"]], ["Generative AI", ["GenAI"]],
    ["RAG", ["retrieval augmented generation", "retrieval-augmented generation"]], "Hugging Face", "LangChain",
    ["Data Analysis", ["data analytics"]], ["Data Pipelines", ["ETL", "data pipeline"]], "Tableau", ["Power BI"],
    "Jupyter", ["Statistics", ["statistical"]], ["Reinforcement Learning"], "CUDA", "MLOps",
  ]),
  ...T("Cloud & DevOps", [
    ["AWS", ["Amazon Web Services", "EC2", "S3", "Lambda"]], ["GCP", ["Google Cloud", "Google Cloud Platform"]],
    ["Azure", ["Microsoft Azure"]], "Docker", ["Kubernetes", ["k8s"]], "Terraform", "Ansible",
    ["CI/CD", ["continuous integration", "continuous delivery", "continuous deployment", "CI / CD"]], "Jenkins",
    ["GitHub Actions"], "Linux", "Unix", "Nginx", "Prometheus", "Grafana", ["Serverless"], "Vercel", "Firebase",
    ["Infrastructure as Code", ["IaC"]], ["Observability", ["monitoring"]],
  ]),
  ...T("Databases", [
    ["PostgreSQL", ["Postgres"]], "MySQL", ["MongoDB", ["mongo"]], "SQLite", "DynamoDB", "Cassandra", "Elasticsearch",
    "Snowflake", "BigQuery", "Oracle", ["NoSQL"], "Supabase", ["Relational Databases", ["relational database", "RDBMS"]],
  ]),
  ...T("Tools", [
    "Git", "GitHub", "GitLab", "Jira", "Figma", "Postman", ["VS Code", ["Visual Studio Code"]], "IntelliJ",
    "Unity", "Unreal Engine", "Selenium", "Jest", "JUnit", "pytest", "Cypress", "Playwright", "Maven", "Gradle",
    "CMake", "GDB", "Xcode", "Android Studio", "Confluence",
  ]),
  ...T("Concepts", [
    ["Data Structures", ["data structure"]], ["Algorithms", ["algorithm"]], ["Object-Oriented Programming", ["OOP", "object oriented", "object-oriented"]],
    ["Distributed Systems", ["distributed system"]], ["System Design"], ["Operating Systems", ["operating system"]],
    ["Computer Networks", ["networking", "TCP/IP"]], ["Concurrency", ["multithreading", "multi-threading", "concurrent"]],
    ["Unit Testing", ["unit tests", "testing", "test-driven development", "TDD"]], ["Debugging"], ["Code Review", ["code reviews"]],
    ["Software Development Life Cycle", ["SDLC"]], ["Scalability", ["scalable"]], ["Performance Optimization", ["optimization", "performance tuning"]],
    ["Security", ["cybersecurity", "secure coding"]], ["Embedded Systems", ["embedded", "firmware", "RTOS"]],
    ["Cloud Computing", ["cloud"]], ["Full Stack", ["full-stack", "fullstack"]], ["Frontend", ["front-end", "front end"]],
    ["Backend", ["back-end", "back end"]], ["Mobile Development", ["mobile"]], ["iOS"], ["Android"], ["API Design", ["APIs", "API"]],
    ["Design Patterns"], ["Compilers", ["compiler"]], ["Computer Architecture"], ["Version Control"], ["Accessibility", ["a11y", "WCAG"]],
  ]),
  ...T("Ways of working", [
    ["Agile", ["Scrum", "Kanban"]], ["Cross-functional Collaboration", ["cross-functional", "cross functional"]],
    ["Communication", ["communication skills"]], ["Problem Solving", ["problem-solving"]], ["Leadership"],
    ["Mentorship", ["mentoring", "mentor"]], ["Ownership"], ["Teamwork", ["collaborative", "collaboration"]],
  ]),
];

/* ---------- matching ---------- */

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function buildRe(alias: string, cs: boolean): RegExp {
  // Tech-aware boundaries so "C" doesn't match "C++", "Java" doesn't match "JavaScript", etc.
  const body = escapeRe(alias).replace(/ /g, "[\\s-]+");
  // Very short case-sensitive names (C, R, Go) also must not touch "&", "-" or "'" (R&D, C-suite, Go-to-market).
  const after = cs ? "(?![A-Za-z0-9+#&'-]|\\.[A-Za-z])" : "(?![A-Za-z0-9+#]|\\.[A-Za-z])";
  const before = cs ? "(?<![A-Za-z0-9+#./&-])" : "(?<![A-Za-z0-9+#./])";
  return new RegExp(`${before}${body}${after}`, cs ? "" : "i");
}

const compiled = TAXONOMY.map((t) => ({
  term: t,
  res: [t.name, ...(t.aliases ?? [])].map((a) => buildRe(a, !!t.cs && a.length <= 2)),
}));

// Never let the bare aliases for these trigger on their own (too noisy as job-text extraction).
const NOISY_FOR_EXTRACTION = new Set(["Cloud Computing", "API Design", "Mobile Development", "Unit Testing", "Performance Optimization", "Security", "Scalability", "Teamwork", "Communication", "Leadership", "Ownership"]);

/** Find taxonomy terms present in text. */
export function extractTerms(text: string, opts: { strict?: boolean } = {}): string[] {
  const found: string[] = [];
  for (const { term, res } of compiled) {
    if (opts.strict && NOISY_FOR_EXTRACTION.has(term.name)) {
      if (!buildRe(term.name, false).test(text)) continue;
      found.push(term.name);
      continue;
    }
    if (res.some((r) => r.test(text))) found.push(term.name);
  }
  return found;
}

function findTerm(keyword: string): (typeof compiled)[number] | undefined {
  const k = keyword.trim().toLowerCase();
  return (
    compiled.find(({ term }) => term.name.toLowerCase() === k) ??
    compiled.find(({ term }) => (term.aliases ?? []).some((a) => a.toLowerCase() === k))
  );
}

const STOP = new Set(["and", "or", "the", "of", "with", "in", "for", "to", "a", "an", "on", "using", "experience", "knowledge", "skills", "strong", "proficiency", "familiarity", "understanding", "ability"]);

/** Does the resume text contain this keyword (taxonomy-aware, then fuzzy phrase match)? */
export function hasKeyword(resumeText: string, keyword: string): boolean {
  const t = findTerm(keyword);
  if (t) return t.res.some((r) => r.test(resumeText));
  // Composite like "Java or C++": any part present counts.
  const parts = keyword.split(/\s*(?:\/|,|\bor\b)\s*/i).filter((p) => p.trim().length > 1);
  if (parts.length > 1) return parts.some((p) => hasKeyword(resumeText, p));
  const direct = buildRe(keyword.trim(), false);
  if (direct.test(resumeText)) return true;
  // All significant tokens present (handles word order / plurals loosely)
  const tokens = keyword.toLowerCase().split(/[^a-z0-9+#.]+/).filter((w) => w.length > 2 && !STOP.has(w));
  if (!tokens.length) return false;
  const lower = resumeText.toLowerCase();
  return tokens.every((w) => lower.includes(w.replace(/s$/, "")));
}

/** Canonical display name if the keyword is in the taxonomy. */
export function canonical(keyword: string): string {
  return findTerm(keyword)?.term.name ?? keyword.trim();
}

/* ---------- scoring ---------- */

type Weighted = { keyword: string; weight: number };

export function weightsFromAnalysis(job: JobAnalysis): Weighted[] {
  const map = new Map<string, Weighted>();
  const add = (k: string, w: number) => {
    const name = canonical(k);
    const key = name.toLowerCase();
    if (!name || name.length > 60) return;
    const prev = map.get(key);
    if (!prev || prev.weight < w) map.set(key, { keyword: name, weight: w });
  };
  job.requiredSkills.forEach((k) => add(k, 3));
  job.preferredSkills.forEach((k) => add(k, 1.5));
  job.keywords.forEach((k) => add(k, 1));
  return [...map.values()];
}

/** Heuristic weights straight from raw posting text (no AI). Required section terms weigh more. */
export function weightsFromText(text: string): Weighted[] {
  const idx = text.search(/(preferred|nice[- ]to[- ]have|bonus points|pluses|desired qualifications|good to have)/i);
  const req = idx > 0 ? text.slice(0, idx) : text;
  const pref = idx > 0 ? text.slice(idx) : "";
  const map = new Map<string, Weighted>();
  for (const k of extractTerms(req, { strict: true })) map.set(k, { keyword: k, weight: 2 });
  for (const k of extractTerms(pref, { strict: true })) if (!map.has(k)) map.set(k, { keyword: k, weight: 1 });
  return [...map.values()];
}

export function atsScore(resumeText: string, weights: Weighted[]): AtsResult {
  if (!weights.length) return { score: 0, matched: [], missing: [], total: 0 };
  let got = 0;
  let total = 0;
  const matched: string[] = [];
  const missing: { k: string; w: number }[] = [];
  for (const { keyword, weight } of weights) {
    total += weight;
    if (hasKeyword(resumeText, keyword)) {
      got += weight;
      matched.push(keyword);
    } else missing.push({ k: keyword, w: weight });
  }
  missing.sort((a, b) => b.w - a.w);
  return {
    score: Math.round((got / total) * 100),
    matched,
    missing: missing.map((m) => m.k),
    total: weights.length,
  };
}

/* ---------- quick fit for job-board listings (title-only) ---------- */

const FUNDAMENTALS = ["Data Structures", "Algorithms", "Object-Oriented Programming", "Git"];
const CORE_LANGS = ["Python", "Java", "C++", "JavaScript", "TypeScript", "Go", "C#"];

const PROFILES: { re: RegExp; skills: string[] }[] = [
  { re: /front[- ]?end|ui engineer|web developer|web engineer|react/i, skills: ["JavaScript", "TypeScript", "React", "HTML", "CSS", "Next.js"] },
  { re: /back[- ]?end|server|api|platform/i, skills: ["Java", "Python", "Go", "SQL", "REST APIs", "Microservices", "PostgreSQL", "Docker"] },
  { re: /full[- ]?stack/i, skills: ["JavaScript", "TypeScript", "React", "Node.js", "SQL", "REST APIs", "PostgreSQL"] },
  { re: /machine learning|\bml\b|\bai\b|deep learning|llm|nlp|computer vision|applied scientist/i, skills: ["Python", "Machine Learning", "PyTorch", "TensorFlow", "NumPy", "Pandas", "Deep Learning"] },
  { re: /data engineer|data platform|analytics engineer|etl/i, skills: ["Python", "SQL", "Spark", "Airflow", "Data Pipelines", "AWS"] },
  { re: /data scien|analyst/i, skills: ["Python", "SQL", "Statistics", "Pandas", "Machine Learning", "Tableau"] },
  { re: /ios|swift/i, skills: ["Swift", "iOS", "SwiftUI", "Objective-C", "Xcode"] },
  { re: /android|kotlin/i, skills: ["Kotlin", "Android", "Java", "Jetpack Compose"] },
  { re: /mobile/i, skills: ["Swift", "Kotlin", "React Native", "Flutter", "iOS", "Android"] },
  { re: /embedded|firmware|hardware|robotics|autonomy|controls/i, skills: ["C", "C++", "Embedded Systems", "Linux", "Python", "Operating Systems"] },
  { re: /devops|site reliability|\bsre\b|infrastructure|cloud|reliability|production engineer/i, skills: ["Linux", "AWS", "Docker", "Kubernetes", "Terraform", "CI/CD", "Python", "Bash"] },
  { re: /security|appsec/i, skills: ["Security", "Python", "Linux", "Computer Networks", "C"] },
  { re: /game|graphics|unity|unreal/i, skills: ["C++", "C#", "Unity", "Unreal Engine"] },
  { re: /distributed|systems engineer|storage|database|kernel/i, skills: ["C++", "Go", "Distributed Systems", "Operating Systems", "Concurrency", "Linux"] },
  { re: /quant|trading/i, skills: ["C++", "Python", "Statistics", "Algorithms"] },
];

export function quickFit(
  title: string,
  category: string,
  degrees: string[],
  resumeTerms: Set<string>,
  resumeHasPhd: boolean,
): { fit: number; matched: string[]; missing: string[] } {
  const prof = PROFILES.filter((p) => p.re.test(title) || p.re.test(category));
  const expected = new Set<string>(FUNDAMENTALS);
  if (prof.length) prof.forEach((p) => p.skills.forEach((s) => expected.add(s)));
  else CORE_LANGS.forEach((s) => expected.add(s));

  const exp = [...expected];
  const matched = exp.filter((s) => resumeTerms.has(s));
  const missing = exp.filter((s) => !resumeTerms.has(s));

  // Languages: having any one core language counts fully when no specific profile.
  let ratio: number;
  if (!prof.length) {
    const langs = CORE_LANGS.filter((l) => resumeTerms.has(l)).length;
    const langScore = langs === 0 ? 0 : langs === 1 ? 0.7 : langs === 2 ? 0.85 : 1;
    const fund = FUNDAMENTALS.filter((f) => resumeTerms.has(f)).length / FUNDAMENTALS.length;
    const breadth = Math.min(1, resumeTerms.size / 20);
    ratio = 0.5 * langScore + 0.3 * fund + 0.2 * breadth;
  } else {
    const profSkills = [...new Set(prof.flatMap((p) => p.skills))];
    const profHit = profSkills.filter((s) => resumeTerms.has(s)).length / profSkills.length;
    const fund = FUNDAMENTALS.filter((f) => resumeTerms.has(f)).length / FUNDAMENTALS.length;
    ratio = 0.75 * Math.min(1, profHit * 1.4) + 0.25 * fund;
  }
  let fit = 25 + 70 * ratio;
  if (/\b(senior|sr\.?|staff|principal|lead|manager|director|iii|iv)\b/i.test(title)) fit -= 25;
  if (/\bii\b/i.test(title)) fit -= 10;
  const phdOnly = degrees.length > 0 && degrees.every((d) => /phd|doctor/i.test(d));
  if ((phdOnly || /\bph\.?d\b/i.test(title)) && !resumeHasPhd) fit -= 20;
  return { fit: Math.max(5, Math.min(98, Math.round(fit))), matched, missing: missing.slice(0, 6) };
}
