"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PrintButton from "@/components/PrintButton";
import PrintHeader from "@/components/PrintHeader";
import { Search, Building2, MapPin } from "lucide-react";
import {
  facultyOfficeHref,
  mapFacultyToOffices,
} from "@/lib/master-plan-inspector";

interface FacultyMember {
  id: number;
  full_name: string;
  academic_rank: string;
  faculty_school: string;
  department: string;
  email: string;
  research_interests: string;
  profile_url: string;
}

export default function FacultyPage() {
  const [faculty, setFaculty] = useState<FacultyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSchool, setSelectedSchool] = useState("");

  useEffect(() => {
    const fetchFaculty = async () => {
      try {
        const res = await fetch("/api/faculty");
        if (!res.ok) {
          throw new Error("Failed to load faculty data");
        }
        const data = await res.json();
        setFaculty(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load faculty");
      } finally {
        setLoading(false);
      }
    };
    fetchFaculty();
  }, []);

  const schools = Array.from(new Set(faculty.map((f) => f.faculty_school).filter(Boolean))).sort();

  const officesByFacultyId = useMemo(
    () => new Map(mapFacultyToOffices(faculty).map((office) => [office.facultyId, office])),
    [faculty],
  );

  const filteredFaculty = faculty.filter((member) => {
    const matchesSearch =
      member.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.research_interests.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSchool = !selectedSchool || member.faculty_school === selectedSchool;
    return matchesSearch && matchesSchool;
  });

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl p-4 sm:p-6">
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Loading faculty...</p>
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-7xl p-4 sm:p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl p-4 sm:p-6 print:p-0">
      <PrintHeader />
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl flex items-center gap-2">
            <Building2 className="h-7 w-7" />
            Faculty Directory
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {filteredFaculty.length} of {faculty.length} faculty members
          </p>
        </div>
        <PrintButton />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 print:hidden">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, department, or research..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={selectedSchool}
          onChange={(e) => setSelectedSchool(e.target.value)}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All Schools/Faculties</option>
          {schools.map((school) => (
            <option key={school} value={school}>
              {school}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-4">
        {filteredFaculty.map((member) => {
          const office = officesByFacultyId.get(String(member.id));
          return (
          <div key={member.id} className="rounded-lg border bg-card p-4 shadow-sm transition hover:shadow-md">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <div>
                  <h2 className="text-lg font-semibold">{member.full_name}</h2>
                  <p className="text-sm text-muted-foreground">{member.academic_rank}</p>
                </div>
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="font-medium">School/Faculty:</span> {member.faculty_school}
                  </p>
                  <p>
                    <span className="font-medium">Department:</span> {member.department || "—"}
                  </p>
                  {member.email && (
                    <p>
                      <span className="font-medium">Email:</span>{" "}
                      <a href={`mailto:${member.email}`} className="text-blue-600 hover:underline">
                        {member.email}
                      </a>
                    </p>
                  )}
                </div>
                {member.research_interests && (
                  <div className="text-sm">
                    <p className="font-medium">Research Interests:</p>
                    <p className="text-muted-foreground mt-1">{member.research_interests}</p>
                  </div>
                )}
              </div>
              <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                {office && (
                  <Link
                    href={facultyOfficeHref(office)}
                    className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-2 text-sm font-medium transition hover:bg-accent print:hidden"
                  >
                    <MapPin className="h-4 w-4" />
                    View Office · {office.building} {office.officeNumber}
                  </Link>
                )}
                {member.profile_url && (
                  <a
                    href={member.profile_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-lg border bg-background px-3 py-2 text-sm font-medium transition hover:bg-accent print:hidden"
                  >
                    View Profile
                  </a>
                )}
              </div>
            </div>
          </div>
          );
        })}
      </div>

      {filteredFaculty.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No faculty members found matching your criteria.
        </div>
      )}
    </main>
  );
}
