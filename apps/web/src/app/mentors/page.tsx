"use client";

import { useEffect, useState } from "react";
import { authenticatedGet, useAuth } from "../../components/auth/auth-context";
import { ArrowRight, Search, MapPin, Star, Sparkles, Filter, SlidersHorizontal, BookOpen } from "lucide-react";
import Link from "next/link";
import { browserBaseUrl } from "../../lib/api";

type MentorProfile = {
  id: number;
  user_id: number;
  display_name: string;
  headline: string | null;
  bio: string | null;
  years_experience: number;
  city: string | null;
  profile_image_url: string | null;
  education: string | null;
  is_verified: boolean;
  specialization_tags: string[];
  highlights: string[];
  credentials: string[];
  email: string;
  username: string;
  specifications?: string[];
  exams?: string[];
  specialization_type?: "all_areas" | "specific_field";
  mentor_type?: "evaluation_mentorship" | "only_mentorship";
};

export default function MentorsPage() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [mentors, setMentors] = useState<MentorProfile[]>([]);
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [minExperience, setMinExperience] = useState<number>(0);
  const [specializationFilter, setSpecializationFilter] = useState<string>("all");
  const [mentorTypeFilter, setMentorTypeFilter] = useState<string>("all");
  const [examFilter, setExamFilter] = useState<string>("all");
  const [configuredExams, setConfiguredExams] = useState<string[]>([]);

  const fetchMentors = async () => {
    try {
      setLoading(true);
      // Fetch public profiles (doesn't strictly require authentication, but use token if available)
      const res = await fetch(`${browserBaseUrl}/api/v1/mentorship/profiles`);
      if (res.ok) {
        const data = await res.json();
        setMentors(data);
      }
    } catch (err) {
      console.error("Failed to load mentors:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchMentors();

    // Fetch configured target exams from settings
    fetch(`${browserBaseUrl}/api/v1/mentorship/settings`)
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error("Failed to load settings");
      })
      .then((data) => {
        if (data && data.target_exams) {
          setConfiguredExams(data.target_exams);
        }
      })
      .catch((err) => console.error("Error loading settings in marketplace:", err));
  }, []);

  // Extract all unique tags
  const allTags = Array.from(
    new Set(mentors.flatMap((m) => m.specialization_tags || []))
  ).filter(Boolean);

  const allExams = Array.from(
    new Set([
      ...configuredExams,
      ...mentors.flatMap((m) => m.exams || [])
    ])
  ).filter(Boolean);

  const filteredMentors = mentors.filter((mentor) => {
    const query = search.trim().toLowerCase();
    
    // Search match
    const matchesSearch = query
      ? mentor.display_name.toLowerCase().includes(query) ||
        (mentor.headline || "").toLowerCase().includes(query) ||
        (mentor.bio || "").toLowerCase().includes(query)
      : true;

    // Tag match
    const matchesTag = selectedTag
      ? mentor.specialization_tags?.includes(selectedTag)
      : true;

    // Experience match
    const matchesExperience = mentor.years_experience >= minExperience;

    // Specialization scope match
    const matchesSpecialization = specializationFilter === "all"
      ? true
      : mentor.specialization_type === specializationFilter;

    // Mentor type match
    const matchesMentorType = mentorTypeFilter === "all"
      ? true
      : mentor.mentor_type === mentorTypeFilter;

    // Target exam match
    const matchesExam = examFilter === "all"
      ? true
      : mentor.exams?.includes(examFilter);

    return matchesSearch && matchesTag && matchesExperience && matchesSpecialization && matchesMentorType && matchesExam;
  });

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Editorial Hero Banner */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 py-16 text-white">
        <div className="absolute left-1/2 top-1/2 h-[450px] w-[450px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/10 blur-[100px]" />
        <div className="container mx-auto max-w-6xl px-6 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/20 px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-indigo-300">
            <span className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
            Empowering Aspirants
          </span>
          <h1 className="mt-6 font-sans text-4xl font-extrabold tracking-tight sm:text-6xl">
            Discover <span className="bg-gradient-to-r from-indigo-400 to-sky-300 bg-clip-text text-transparent">UPSC Mentors</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-300">
            Connect 1-on-1 with verified civil servants and exam experts. Upload subjective copies for copy evaluation or book a guidance session.
          </p>
        </div>
      </section>

      {/* Discovery Filters Workspace */}
      <main className="container mx-auto -mt-8 max-w-6xl px-6">
        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-xl">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, subject, or GS paper..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-12 pr-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-indigo-500 focus:bg-white"
              />
            </div>

            {/* Experience Filter Dropdown */}
            <div className="flex items-center gap-3">
              <label className="text-xs font-black uppercase tracking-wider text-slate-500 shrink-0">
                Experience
              </label>
              <select
                value={minExperience}
                onChange={(e) => setMinExperience(Number(e.target.value))}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-700 outline-none cursor-pointer focus:border-indigo-500"
              >
                <option value={0}>Any Experience</option>
                <option value={2}>2+ Years</option>
                <option value={5}>5+ Years</option>
                <option value={8}>8+ Years</option>
              </select>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3 border-t border-slate-100 pt-4">
            {/* Mentor Type Filter */}
            <div className="flex items-center gap-3 justify-between sm:justify-start">
              <label className="text-xs font-black uppercase tracking-wider text-slate-500 shrink-0">
                Mentorship Type
              </label>
              <select
                value={mentorTypeFilter}
                onChange={(e) => setMentorTypeFilter(e.target.value)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 outline-none cursor-pointer focus:border-indigo-500"
              >
                <option value="all">Any Type</option>
                <option value="evaluation_mentorship">Evaluation + Mentorship</option>
                <option value="only_mentorship">Only Mentorship</option>
              </select>
            </div>

            {/* Specialization Type Filter */}
            <div className="flex items-center gap-3 justify-between sm:justify-start">
              <label className="text-xs font-black uppercase tracking-wider text-slate-500 shrink-0">
                Specialization Scope
              </label>
              <select
                value={specializationFilter}
                onChange={(e) => setSpecializationFilter(e.target.value)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 outline-none cursor-pointer focus:border-indigo-500"
              >
                <option value="all">Any Scope</option>
                <option value="all_areas">Expert in all areas</option>
                <option value="specific_field">Expert in specific field</option>
              </select>
            </div>

            {/* Exams Filter */}
            <div className="flex items-center gap-3 justify-between sm:justify-start">
              <label className="text-xs font-black uppercase tracking-wider text-slate-500 shrink-0">
                Target Exam
              </label>
              <select
                value={examFilter}
                onChange={(e) => setExamFilter(e.target.value)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 outline-none cursor-pointer focus:border-indigo-500"
              >
                <option value="all">Any Exam</option>
                {allExams.map((exam) => (
                  <option key={exam} value={exam}>
                    {exam}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Tags Filter Row */}
          {allTags.length > 0 && (
            <div className="mt-6 border-t border-slate-100 pt-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
                Filter by Subject Focus
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedTag(null)}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                    selectedTag === null
                      ? "bg-slate-900 text-white shadow-sm"
                      : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  All Focus
                </button>
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(tag)}
                    className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                      selectedTag === tag
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Directory Grid */}
        <div className="mt-12">
          {loading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-96 rounded-[32px] border border-slate-100 bg-white p-6 animate-pulse" />
              ))}
            </div>
          ) : filteredMentors.length === 0 ? (
            <div className="rounded-[40px] border border-dashed border-slate-300 bg-white p-16 text-center">
              <BookOpen className="mx-auto h-12 w-12 text-slate-300 mb-4 animate-bounce" />
              <h3 className="text-xl font-bold text-slate-800">No Mentors Found</h3>
              <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto">
                No mentors match your search query. Try resetting filters or using a broader term.
              </p>
              <button
                onClick={() => {
                  setSearch("");
                  setSelectedTag(null);
                  setMinExperience(0);
                  setSpecializationFilter("all");
                  setMentorTypeFilter("all");
                  setExamFilter("all");
                }}
                className="mt-6 rounded-2xl bg-indigo-600 px-6 py-3 text-xs font-bold text-white shadow-md hover:bg-indigo-700"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredMentors.map((mentor) => (
                <article
                  key={mentor.user_id}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-xl hover:border-indigo-100"
                >
                  <div>
                    {/* Header: Picture & Basic info */}
                    <div className="flex items-start gap-4">
                      {mentor.profile_image_url ? (
                        <img
                          src={mentor.profile_image_url}
                          alt={mentor.display_name}
                          className="h-14 w-14 rounded-2xl object-cover border border-slate-100 group-hover:scale-105 transition duration-300"
                        />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-xl font-black text-indigo-600">
                          {mentor.display_name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-extrabold text-slate-800 text-base group-hover:text-indigo-600 transition">
                            {mentor.display_name}
                          </h3>
                          {mentor.is_verified && (
                            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[10px] text-white" title="Verified Credentials">
                              ✓
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 font-semibold mt-0.5 line-clamp-1">
                          {mentor.headline || "UPSC Mentorship Expert"}
                        </p>
                      </div>
                    </div>

                    {/* Bio Snippet */}
                    <p className="mt-5 text-xs text-slate-500 leading-relaxed line-clamp-3">
                      {mentor.bio || "UPSC Mentorship Expert guiding aspirants through Optional syllabus and Copy Evaluations."}
                    </p>

                    {/* Mentorship properties: Type and Specialization */}
                    <div className="mt-3 flex flex-wrap gap-1 items-center">
                      <span className="text-[10px] font-black uppercase bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded border border-indigo-100/50">
                        {mentor.mentor_type === "only_mentorship" ? "Only Mentorship" : "Evaluation + Mentorship"}
                      </span>
                      <span className="text-[10px] font-black uppercase bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded border border-slate-200">
                        {mentor.specialization_type === "specific_field" ? "Specific Field Expert" : "Expert in all areas"}
                      </span>
                    </div>

                    {/* Admin-assigned Specifications */}
                    {mentor.specifications && mentor.specifications.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {mentor.specifications.map((spec, sidx) => (
                          <span key={sidx} className="rounded-md bg-emerald-50 text-emerald-800 px-2 py-0.5 text-[9px] font-bold border border-emerald-100/40">
                            {spec}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Target Exams Coverage */}
                    {mentor.exams && mentor.exams.length > 0 && (
                      <p className="mt-3.5 text-[10px] text-slate-500 font-medium leading-relaxed">
                        Exams: <span className="font-bold text-slate-700">{mentor.exams.join(", ")}</span>
                      </p>
                    )}

                    {/* Education Snippet */}
                    {mentor.education && (
                      <p className="mt-3 text-[11px] text-slate-400 font-medium line-clamp-1 flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-300 shrink-0" />
                        🎓 {mentor.education}
                      </p>
                    )}

                    {/* Highlights (Capsules) */}
                    {mentor.highlights && mentor.highlights.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {mentor.highlights.slice(0, 2).map((hl, idx) => (
                          <span
                            key={idx}
                            className="rounded-full bg-slate-50 border border-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600"
                          >
                            {hl}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer Action */}
                  <div className="mt-6 border-t border-slate-100 pt-4 flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-slate-900 bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg">
                      ₹1,000 <span className="text-[10px] font-semibold text-slate-500">/ session</span>
                    </span>
                    
                    <Link
                      href={`/mentors/${mentor.user_id}`}
                      className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-indigo-600 group-hover:shadow-md"
                    >
                      Request Details
                      <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
