import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Download, LogOut, Moon, PieChart, SunMedium, Table, TrendingUp, Users, BarChart3, CircleDashed, ShieldCheck, Sparkles } from "lucide-react";
import {
  fetchAllFeedbackWithAlumni,
  fetchDashboardOverview,
  fetchEmploymentTrends,
  fetchIndustryDistribution,
  fetchSkills,
  downloadCsv,
  DashboardOverview,
  FeedbackWithAlumni,
  SkillRow,
} from "@/services/supabaseService";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Pie,
  PieChart as RechartsPieChart,
} from "recharts";

const palette = ["#8B5CF6", "#A78BFA", "#C4B5FD", "#E9D5FF", "#D8B4FE"];
const pageSize = 6;

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [search, setSearch] = useState("");
  const [programFilter, setProgramFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    const nextTheme = savedTheme ?? "light";
    setTheme(nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [authLoading, user, navigate]);

  const overviewQuery = useQuery<DashboardOverview>({
    queryKey: ["dashboard", "overview"],
    queryFn: fetchDashboardOverview,
    enabled: !!user,
    staleTime: 1000 * 60 * 3,
  });

  const skillsQuery = useQuery<SkillRow[]>({
    queryKey: ["dashboard", "skills"],
    queryFn: fetchSkills,
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  const feedbackQuery = useQuery<FeedbackWithAlumni[]>({
    queryKey: ["dashboard", "feedback"],
    queryFn: fetchAllFeedbackWithAlumni,
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  const industryQuery = useQuery<{ name: string; value: number }[]>({
    queryKey: ["dashboard", "industry"],
    queryFn: fetchIndustryDistribution,
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  const trendsQuery = useQuery<{ date: string; employed: number }[]>({
    queryKey: ["dashboard", "trends"],
    queryFn: fetchEmploymentTrends,
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  const filteredFeedback = useMemo(() => {
    const rows = feedbackQuery.data ?? [];
    const normalizedSearch = search.trim().toLowerCase();

    return rows.filter((item) => {
      const name = item.alumni?.name?.toLowerCase() ?? "";
      const program = item.alumni?.program?.toLowerCase() ?? "";
      const year = String(item.alumni?.year_graduated ?? "");
      const industry = item.industry?.toLowerCase() ?? "";
      const rating = String(item.skill_relevance_rating ?? "");
      const content = [name, program, year, industry, rating, item.feedback_text ?? ""].join(" ");
      const matchesSearch = normalizedSearch ? content.includes(normalizedSearch) : true;
      const matchesProgram = programFilter ? program === programFilter.toLowerCase() : true;
      const matchesYear = yearFilter ? year === yearFilter : true;
      return matchesSearch && matchesProgram && matchesYear;
    });
  }, [feedbackQuery.data, search, programFilter, yearFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, programFilter, yearFilter]);

  const programs = useMemo(() => {
    const values = new Set<string>();
    feedbackQuery.data?.forEach((item) => {
      if (item.alumni?.program) values.add(item.alumni.program);
    });
    return Array.from(values).sort();
  }, [feedbackQuery.data]);

  const years = useMemo(() => {
    const values = new Set<number>();
    feedbackQuery.data?.forEach((item) => {
      if (item.alumni?.year_graduated) values.add(item.alumni.year_graduated);
    });
    return Array.from(values).sort((a, b) => b - a);
  }, [feedbackQuery.data]);

  const pageCount = Math.max(1, Math.ceil(filteredFeedback.length / pageSize));
  const visibleFeedback = filteredFeedback.slice((page - 1) * pageSize, page * pageSize);

  const skills = skillsQuery.data ?? [];
  const competencyRadar = skills.map((skill) => ({
    skill: skill.skill_name,
    Required: skill.required_level ?? 0,
    Acquired: skill.acquired_level ?? 0,
  }));

  const skillGaps = skills
    .map((skill) => ({
      skill: skill.skill_name,
      required: skill.required_level ?? 0,
      acquired: skill.acquired_level ?? 0,
      gap: Math.max((skill.required_level ?? 0) - (skill.acquired_level ?? 0), 0),
    }))
    .sort((a, b) => b.gap - a.gap);

  const strengths = skillGaps.filter((item) => item.gap === 0);
  const weaknesses = skillGaps.filter((item) => item.gap >= 2);

  const insights = [
    overviewQuery.data
      ? `Most graduates are employed in ${overviewQuery.data.topIndustry}.`
      : "Loading strategic insights...",
    skillGaps.length
      ? `Skill gap detected in ${skillGaps[0].skill} (${skillGaps[0].gap} point gap).`
      : "No critical skill gaps detected yet.",
    overviewQuery.data?.avgSkillRelevance
      ? `Average relevance rating is ${overviewQuery.data.avgSkillRelevance} of 5.`
      : "Awaiting rating data from alumni feedback.",
  ];

  const exportRows = feedbackQuery.data?.map((item) => ({
    name: item.alumni?.name ?? "Unknown",
    program: item.alumni?.program ?? "Unknown",
    year_graduated: item.alumni?.year_graduated ?? "Unknown",
    employment_status: item.employment_status ?? "Unknown",
    industry: item.industry ?? "Unknown",
    skill_relevance_rating: item.skill_relevance_rating ?? "0",
    feedback_text: item.feedback_text ?? "",
    submitted_at: item.created_at ?? "",
  })) ?? [];

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(139,92,246,0.15),_transparent_35%),linear-gradient(135deg,_rgba(167,139,250,0.2),_rgba(232,210,255,0.15))] p-6">
        <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(139,92,246,0.12),_transparent_20%),linear-gradient(180deg,_hsl(262,83%,97%)_0%,_hsl(280,70%,95%)_100%)] text-foreground dark:bg-[radial-gradient(circle_at_top,_rgba(139,92,246,0.16),_transparent_25%),linear-gradient(180deg,_hsl(270,30%,10%)_0%,_hsl(270,30%,8%)_100%)]">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-6 px-4 py-6 lg:px-8">
        <header className="flex flex-col gap-4 rounded-[2rem] border border-border bg-white/80 p-6 shadow-xl shadow-violet-100/30 backdrop-blur-xl dark:bg-slate-950/80 dark:shadow-slate-950/40 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-[0.24em] text-primary">CEITE Alumni Feedback</p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
              Curriculum Alignment Dashboard
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Monitor alumni sentiment, employment outcomes, and curriculum gaps to align CEITE programs with industry expectations.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="rounded-3xl border border-input bg-muted px-4 py-3 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-200">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Signed in as</p>
              <p className="font-medium">{user?.email ?? "Alumni user"}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={toggleTheme} className="flex items-center gap-2">
                {theme === "dark" ? <SunMedium className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                {theme === "dark" ? "Light Mode" : "Dark Mode"}
              </Button>
              <Button variant="secondary" onClick={handleSignOut} className="flex items-center gap-2">
                <LogOut className="h-4 w-4" /> Sign out
              </Button>
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(220px,_1fr)_minmax(560px,_2fr)]">
          <aside className="space-y-6 rounded-[2rem] border border-border bg-white/80 p-6 shadow-xl shadow-violet-100/30 backdrop-blur-xl dark:bg-slate-950/80 dark:shadow-slate-950/40">
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Navigation</h2>
              <nav className="space-y-2 text-sm text-muted-foreground">
                {[
                  { label: "Dashboard", icon: "dashboard" },
                  { label: "Alumni Feedback", icon: "users" },
                  { label: "Tracer Study", icon: "trending-up" },
                  { label: "Curriculum Alignment", icon: "bar-chart-3" },
                  { label: "Reports", icon: "file-text" },
                  { label: "Settings", icon: "shield-check" },
                ].map((item) => (
                  <button
                    key={item.label}
                    className="flex w-full items-center gap-3 rounded-2xl border border-transparent px-4 py-3 text-left transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary dark:hover:bg-slate-800"
                  >
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 text-primary dark:bg-primary/20">
                      {item.icon === "dashboard" ? <CircleDashed className="h-4 w-4" /> : null}
                      {item.icon === "users" ? <Users className="h-4 w-4" /> : null}
                      {item.icon === "trending-up" ? <TrendingUp className="h-4 w-4" /> : null}
                      {item.icon === "bar-chart-3" ? <BarChart3 className="h-4 w-4" /> : null}
                      {item.icon === "file-text" ? <Table className="h-4 w-4" /> : null}
                      {item.icon === "shield-check" ? <ShieldCheck className="h-4 w-4" /> : null}
                    </span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </nav>
            </div>
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Insights</h2>
              <div className="space-y-3">
                {insights.map((insight, index) => (
                  <div key={index} className="rounded-3xl border border-border bg-slate-50/80 p-4 dark:bg-slate-900/80">
                    <p className="text-sm leading-6">{insight}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-3xl border border-border bg-slate-50/80 p-5 dark:bg-slate-900/80">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-muted-foreground">Reports</p>
                  <h3 className="text-base font-semibold">Export analytics</h3>
                </div>
                <Download className="h-5 w-5 text-primary" />
              </div>
              <Button onClick={() => downloadCsv(exportRows, "alumni-feedback-report.csv")} className="w-full" variant="default">
                Export CSV
              </Button>
            </div>
          </aside>

          <main className="space-y-6">
            <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              <Card className="overflow-hidden border-transparent bg-white/85 shadow-xl shadow-violet-100/30 dark:bg-slate-950/80">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Users className="h-5 w-5" />
                    </div>
                    <span className="rounded-full bg-violet-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-violet-700 dark:bg-violet-900/20 dark:text-violet-200">
                      Live
                    </span>
                  </div>
                  <CardTitle>{overviewQuery.data?.totalRespondents ?? "—"}</CardTitle>
                  <CardDescription>Total Alumni Respondents</CardDescription>
                </CardHeader>
              </Card>

              <Card className="overflow-hidden border-transparent bg-white/85 shadow-xl shadow-violet-100/30 dark:bg-slate-950/80">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <TrendingUp className="h-5 w-5" />
                    </div>
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200">
                      Rate
                    </span>
                  </div>
                  <CardTitle>{overviewQuery.data ? `${overviewQuery.data.employmentRate}%` : "—"}</CardTitle>
                  <CardDescription>Employment Rate</CardDescription>
                </CardHeader>
              </Card>

              <Card className="overflow-hidden border-transparent bg-white/85 shadow-xl shadow-violet-100/30 dark:bg-slate-950/80">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <PieChart className="h-5 w-5" />
                    </div>
                    <span className="rounded-full bg-sky-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-sky-700 dark:bg-sky-900/20 dark:text-sky-200">
                      Top
                    </span>
                  </div>
                  <CardTitle>{overviewQuery.data?.topIndustry ?? "—"}</CardTitle>
                  <CardDescription>Top Industry</CardDescription>
                </CardHeader>
              </Card>

              <Card className="overflow-hidden border-transparent bg-white/85 shadow-xl shadow-violet-100/30 dark:bg-slate-950/80">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
                      Avg
                    </span>
                  </div>
                  <CardTitle>{overviewQuery.data?.avgSkillRelevance ?? "—"}/5</CardTitle>
                  <CardDescription>Average Skill Relevance Rating</CardDescription>
                </CardHeader>
              </Card>
            </section>

            <section className="grid gap-6 xl:grid-cols-[0.9fr_0.7fr]">
              <Card className="border-transparent bg-white/85 shadow-xl shadow-violet-100/30 dark:bg-slate-950/80">
                <CardHeader>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <CardTitle>Skills Gap Overview</CardTitle>
                      <CardDescription>Required vs acquired competency levels by skill.</CardDescription>
                    </div>
                    <div className="rounded-2xl bg-secondary/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-secondary-foreground">
                      Data-driven</div>
                  </div>
                </CardHeader>
                <CardContent className="h-[340px]">
                  {skills.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={skillGaps} margin={{ top: 10, right: 16, left: -18, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                        <XAxis dataKey="skill" tick={{ fill: "#6b7280", fontSize: 12 }} />
                        <YAxis allowDecimals={false} tick={{ fill: "#6b7280", fontSize: 12 }} />
                        <Tooltip formatter={(value: number) => [value, "Level"]} />
                        <Bar dataKey="required" fill="#8B5CF6" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="acquired" fill="#A78BFA" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex min-h-[240px] items-center justify-center text-sm text-muted-foreground">
                      No skill data available yet.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-transparent bg-white/85 shadow-xl shadow-violet-100/30 dark:bg-slate-950/80">
                <CardHeader>
                  <CardTitle>Industry Distribution</CardTitle>
                  <CardDescription>Where alumni are working today.</CardDescription>
                </CardHeader>
                <CardContent className="h-[340px]">
                  {industryQuery.data?.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={industryQuery.data}
                          innerRadius={60}
                          outerRadius={100}
                          dataKey="value"
                          nameKey="name"
                          stroke="transparent"
                          paddingAngle={4}
                        >
                          {industryQuery.data.map((entry, index) => (
                            <Cell key={entry.name} fill={palette[index % palette.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => [value, "responses"]} />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex min-h-[240px] items-center justify-center text-sm text-muted-foreground">
                      Waiting for industry responses.
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-6 xl:grid-cols-[0.9fr_0.7fr]">
              <Card className="border-transparent bg-white/85 shadow-xl shadow-violet-100/30 dark:bg-slate-950/80">
                <CardHeader>
                  <div>
                    <CardTitle>Employment Trends</CardTitle>
                    <CardDescription>Measure alumni employment growth by month.</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="h-[320px]">
                  {trendsQuery.data?.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendsQuery.data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                        <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 12 }} />
                        <YAxis allowDecimals={false} tick={{ fill: "#6b7280", fontSize: 12 }} />
                        <Tooltip formatter={(value: number) => [value, "Employed"]} />
                        <Line type="monotone" dataKey="employed" stroke="#8B5CF6" strokeWidth={3} dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex min-h-[240px] items-center justify-center text-sm text-muted-foreground">
                      No employment trend data yet.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-transparent bg-white/85 shadow-xl shadow-violet-100/30 dark:bg-slate-950/80">
                <CardHeader>
                  <CardTitle>Competency Radar</CardTitle>
                  <CardDescription>Compare required skills with acquired proficiency.</CardDescription>
                </CardHeader>
                <CardContent className="h-[320px]">
                  {competencyRadar.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={competencyRadar} outerRadius={110}>
                        <PolarGrid strokeOpacity={0.1} />
                        <PolarAngleAxis dataKey="skill" tick={{ fill: "#6b7280", fontSize: 12 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 5]} tickCount={6} tick={{ fill: "#6b7280", fontSize: 10 }} />
                        <Radar name="Required" dataKey="Required" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.3} />
                        <Radar name="Acquired" dataKey="Acquired" stroke="#A78BFA" fill="#A78BFA" fillOpacity={0.3} />
                        <Tooltip />
                      </RadarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex min-h-[240px] items-center justify-center text-sm text-muted-foreground">
                      Curriculum skills not available yet.
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-6 xl:grid-cols-[0.95fr_0.9fr]">
              <Card className="border-transparent bg-white/85 shadow-xl shadow-violet-100/30 dark:bg-slate-950/80">
                <CardHeader>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <CardTitle>Alumni Feedback Table</CardTitle>
                      <CardDescription>Search, filter, and review alumni responses.</CardDescription>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Input placeholder="Search" value={search} onChange={(event) => setSearch(event.target.value)} />
                      <select
                        className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={programFilter}
                        onChange={(event) => setProgramFilter(event.target.value)}
                      >
                        <option value="">All programs</option>
                        {programs.map((program) => (
                          <option key={program} value={program}>
                            {program}
                          </option>
                        ))}
                      </select>
                      <select
                        className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={yearFilter}
                        onChange={(event) => setYearFilter(event.target.value)}
                      >
                        <option value="">All years</option>
                        {years.map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="overflow-hidden rounded-[2rem] border border-border bg-slate-50/70 p-0 dark:bg-slate-900/80">
                  <div className="overflow-x-auto">
                    <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                      <thead className="bg-slate-100 text-slate-600 dark:bg-slate-950/80 dark:text-slate-300">
                        <tr>
                          <th className="px-4 py-3">Name</th>
                          <th className="px-4 py-3">Program</th>
                          <th className="px-4 py-3">Year</th>
                          <th className="px-4 py-3">Employment</th>
                          <th className="px-4 py-3">Industry</th>
                          <th className="px-4 py-3">Skill Rating</th>
                          <th className="px-4 py-3">Feedback</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleFeedback.length ? (
                          visibleFeedback.map((item) => (
                            <tr key={item.id} className="border-b border-border last:border-none hover:bg-slate-100 dark:hover:bg-slate-900/80">
                              <td className="px-4 py-4 font-medium text-slate-900 dark:text-slate-100">{item.alumni?.name ?? "Unknown"}</td>
                              <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{item.alumni?.program ?? "N/A"}</td>
                              <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{item.alumni?.year_graduated ?? "N/A"}</td>
                              <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{item.employment_status ?? "Unknown"}</td>
                              <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{item.industry ?? "Unknown"}</td>
                              <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{item.skill_relevance_rating ?? "—"}</td>
                              <td className="px-4 py-4 text-slate-600 dark:text-slate-300 max-w-[280px] truncate">{item.feedback_text ?? "—"}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                              {feedbackQuery.isLoading ? "Loading feedback..." : "No matching feedback records found."}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
                <CardFooter className="justify-between gap-4">
                  <span className="text-sm text-muted-foreground">
                    Showing {visibleFeedback.length} of {filteredFeedback.length} entries
                  </span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                      Prev
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {page} of {pageCount}
                    </span>
                    <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>
                      Next
                    </Button>
                  </div>
                </CardFooter>
              </Card>

              <Card className="space-y-6 border-transparent bg-white/85 p-6 shadow-xl shadow-violet-100/30 dark:bg-slate-950/80">
                <CardHeader>
                  <CardTitle>Curriculum Alignment</CardTitle>
                  <CardDescription>Strengths, weaknesses, and skill gaps for CEITE curriculum review.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {skillGaps.length ? (
                    skillGaps.slice(0, 5).map((item) => {
                      const completion = item.required ? Math.round((item.acquired / item.required) * 100) : 0;
                      return (
                        <div key={item.skill} className="space-y-2">
                          <div className="flex items-center justify-between gap-4">
                            <p className="font-medium">{item.skill}</p>
                            <span className={cn("rounded-full px-2 py-1 text-xs font-semibold uppercase tracking-[0.2em]", item.gap ? "bg-rose-100 text-rose-700 dark:bg-rose-900/20 dark:text-rose-200" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200")}>{item.gap ? `Gap ${item.gap}` : "Strength"}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Required {item.required} · Acquired {item.acquired}
                          </div>
                          <Progress value={Math.min(100, completion)} />
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-muted-foreground">No curriculum skill data to analyze yet.</p>
                  )}
                </CardContent>
              </Card>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
