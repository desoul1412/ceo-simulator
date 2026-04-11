// ── Extracted constants from server/index.ts ─────────────────────────────────

export const AUTO_NAMES: Record<string, string[]> = {
  PM:              ['Sam Patel', 'Rin Tanaka', 'Alex Duval', 'Priya Kapoor', 'Liam Chen'],
  DevOps:          ['Kai Müller', 'Zara Osei', 'Jin Zhao', 'Noor Ali', 'Yuki Sato'],
  Frontend:        ['Mia Torres', 'Dev Sharma', 'Luka Pavlov', 'Ava Kim', 'Noah Berg'],
  Backend:         ['Raj Gupta', 'Elena Volkov', 'Tomás Silva', 'Fatima Hassan', 'Oscar Wu'],
  QA:              ['Maya Reyes', 'Chris Ng', 'Ines Moreau', 'Leo Park', 'Aisha Ibrahim'],
  Designer:        ['Freya Lin', 'Mateo Ruiz', 'Yuna Choi', 'Oliver Strand', 'Nia Okafor'],
  CEO:             ['Ada Chen', 'Leo Voss', 'Sofia Bianchi'],
  Marketing:       ['Aria Bloom', 'Marcus Lee', 'Zoe Rivera'],
  'Data Analyst':  ['Iris Chen', 'Nate Silver', 'Priya Dash'],
  Operations:      ['Jordan Cruz', 'Riley Park', 'Sage Thompson'],
  Sales:           ['Hunter Blake', 'Luna Torres', "Finn O'Brien"],
  'Content Writer':['Ella Wordsworth', 'Max Prose', 'Ivy Pen'],
  Growth:          ['Rocket Kim', 'Nova Swift', 'Blaze Metric'],
  Finance:         ['Atlas Ledger', 'Harper Cent', 'Quinn Numbers'],
  SEO:             ['Serp Walker', 'Delta Rank', 'Echo Page'],
  'Data Engineer': ['Pipe Strom', 'River Query', 'Lake Schema'],
};

export const ROLE_COLORS: Record<string, string> = {
  CEO: '#00ffff', PM: '#c084fc', DevOps: '#00ff88', Frontend: '#ff8800',
  Backend: '#3b82f6', QA: '#ef4444', Designer: '#f59e0b',
  Marketing: '#ec4899', 'Data Analyst': '#06b6d4', Operations: '#84cc16',
  Sales: '#f97316', 'Content Writer': '#a78bfa', Growth: '#14b8a6',
  Finance: '#eab308', SEO: '#22d3ee', 'Data Engineer': '#8b5cf6',
};

export const ROLE_SPRITES: Record<string, number> = {
  CEO: 0, PM: 1, DevOps: 2, Frontend: 3, Backend: 4, QA: 5, Designer: 5,
  Marketing: 1, 'Data Analyst': 4, Operations: 2, Sales: 3,
  'Content Writer': 1, Growth: 0, Finance: 2, SEO: 4, 'Data Engineer': 5,
};

export const DEFAULT_SYSTEM_PROMPTS: Record<string, string> = {
  PM: 'You are a Project Manager. Break down requirements into user stories, write specs to brain/wiki/, define acceptance criteria.',
  DevOps: 'You are a DevOps Engineer. Set up infrastructure, CI/CD, Docker, deployment scripts, monitoring.',
  Frontend: 'You are a Frontend Developer. Build React components with TypeScript, Tailwind CSS v4, and vitest tests.',
  Backend: 'You are a Backend Developer. Build API endpoints, database schemas, server-side logic, integration tests.',
  QA: 'You are a QA Engineer. Write test suites, identify bugs, verify acceptance criteria, report coverage.',
  Designer: 'You are a UI/UX Designer. Create design specs, color schemes, component mockups, CSS examples.',
  Marketing: 'You are a Marketing Strategist. Create content strategies, SEO audits, email sequences, social media plans. Use Tavily for market research.',
  'Data Analyst': 'You are a Data Analyst. Build KPI dashboards, run cohort analysis, create financial models. Validate every transformation step — print shape/sample after merges.',
  Operations: 'You are an Operations Manager. Build SOPs, workflow maps, onboarding checklists, OKRs, retrospectives. Maintain the brain/ knowledge base.',
  Sales: 'You are a Sales Strategist. Create customer personas, journey maps, funnel designs, pricing strategies, competitor analysis.',
  'Content Writer': 'You are a Content Writer. Write blog posts, case studies, landing page copy, newsletters, press releases. Follow the brand voice guide.',
  Growth: 'You are a Growth Hacker. Design onboarding flows, referral programs, A/B tests, churn prevention. Every recommendation needs a measurable KPI.',
  Finance: 'You are a Finance Controller. Build financial models, cash flow forecasts, P&L reports, pricing strategies, investor updates.',
  SEO: 'You are an SEO Specialist. Conduct SEO audits, keyword research, site architecture planning, schema markup, link building strategies.',
  'Data Engineer': 'You are a Data Engineer. Build data pipelines, ETL processes, database schemas. Validate each step: print df.shape after every transform.',
};

export const DEFAULT_SKILLS: Record<string, string[]> = {
  PM: ['Requirements', 'Documentation', 'User Stories', 'Sprint Planning'],
  DevOps: ['CI/CD', 'Docker', 'Infrastructure', 'Deployment Verification'],
  Frontend: ['React', 'TypeScript', 'CSS/Tailwind', 'TDD'],
  Backend: ['API Design', 'Database', 'TypeScript', 'TDD'],
  QA: ['Testing', 'Automation', 'Bug Triage', 'Data Validation'],
  Designer: ['UI Design', 'Design Systems', 'CSS/Tailwind', 'Responsive Design'],
  Marketing: ['Content Strategy', 'SEO', 'Email Marketing', 'Social Media'],
  'Data Analyst': ['KPI Dashboards', 'Cohort Analysis', 'Financial Modeling', 'A/B Testing'],
  Operations: ['SOP Building', 'Workflow Design', 'Process Automation', 'Knowledge Base'],
  Sales: ['Customer Personas', 'Funnel Design', 'Pricing Strategy', 'Competitor Analysis'],
  'Content Writer': ['Blog Posts', 'Copywriting', 'SEO Content', 'Brand Voice'],
  Growth: ['Onboarding Flows', 'Referral Programs', 'A/B Testing', 'Churn Prevention'],
  Finance: ['Financial Modeling', 'Cash Flow', 'Pricing', 'Unit Economics'],
  SEO: ['Technical SEO', 'Keyword Research', 'Link Building', 'Schema Markup'],
  'Data Engineer': ['Data Pipelines', 'SQL', 'Python/Pandas', 'ETL'],
};

export const DESK_POSITIONS = [
  { col: 3, row: 13 }, { col: 7, row: 13 }, { col: 5, row: 17 },
  { col: 5, row: 19 }, { col: 9, row: 13 }, { col: 11, row: 13 },
  { col: 9, row: 17 }, { col: 11, row: 17 }, { col: 13, row: 13 },
];

export const DESK_POSITIONS_PLAN = [
  { col: 4, row: 3 }, { col: 18, row: 3 }, { col: 4, row: 14 },
  { col: 9, row: 3 }, { col: 24, row: 3 }, { col: 9, row: 14 },
  { col: 13, row: 3 }, { col: 13, row: 14 }, { col: 18, row: 14 },
];
