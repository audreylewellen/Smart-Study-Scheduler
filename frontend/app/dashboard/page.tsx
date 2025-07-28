"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getValidToken, refreshTokenIfNeeded } from "@/utils/auth";
import { FaBook, FaCheckCircle, FaFire } from "react-icons/fa";
import React from "react";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, isSameMonth, isSameDay, addMonths, subMonths, format } from "date-fns";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

interface Class {
  id: string;
  name: string;
  description?: string;
}

interface ReviewTask {
  id: string;
  chunk_id: string;
  scheduled_date: string;
  task_type: string;
  completed: boolean;
}

// Utility for user preferences
const defaultPreferences = {
  studyDays: [1, 2, 3, 4, 5], // Mon-Fri
  intensity: "medium", // light, medium, hard
};

function getUserPreferences() {
  if (typeof window === "undefined") return defaultPreferences;
  const stored = localStorage.getItem("userPreferences");
  if (stored) return JSON.parse(stored);
  return defaultPreferences;
}

function setUserPreferences(prefs: any) {
  localStorage.setItem("userPreferences", JSON.stringify(prefs));
}

// Calendar colors for task types
const TASK_COLORS: Record<string, string> = {
  learn: "bg-blue-200 border-blue-400 text-blue-900",
  quiz: "bg-yellow-200 border-yellow-400 text-yellow-900",
  review: "bg-green-200 border-green-400 text-green-900",
};

export default function DashboardPage() {
  const router = useRouter();
  const [classes, setClasses] = useState<Class[]>([]);
  const [todaysReviews, setTodaysReviews] = useState<ReviewTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPrefs, setShowPrefs] = useState(false);
  const [preferences, setPreferences] = useState(getUserPreferences());
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [monthTasks, setMonthTasks] = useState<ReviewTask[]>([]);
  const [monthTasksLoading, setMonthTasksLoading] = useState(false);

  const fetchClasses = async (token: string) => {
    const res = await fetch(`${backendUrl}/api/classes`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    if (res.status === 401) {
      // Token expired, try to refresh
      const newToken = await refreshTokenIfNeeded();
      if (newToken) {
        // Retry with new token
        const retryRes = await fetch(`${backendUrl}/api/classes`, {
          headers: { Authorization: `Bearer ${newToken}` },
        });
        if (retryRes.ok) {
          const data = await retryRes.json();
          setClasses(data.classes || []);
        } else {
          router.replace("/login");
        }
      } else {
        router.replace("/login");
      }
    } else if (res.ok) {
      const data = await res.json();
      setClasses(data.classes || []);
    } else {
      router.replace("/login");
    }
  };

  const fetchTodaysReviews = async (token: string) => {
    const res = await fetch(`${backendUrl}/api/reviews/today`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    if (res.status === 401) {
      // Token expired, try to refresh
      const newToken = await refreshTokenIfNeeded();
      if (newToken) {
        // Retry with new token
        const retryRes = await fetch(`${backendUrl}/api/reviews/today`, {
          headers: { Authorization: `Bearer ${newToken}` },
        });
        if (retryRes.ok) {
          const data = await retryRes.json();
          setTodaysReviews(data.reviews || []);
        }
      }
    } else if (res.ok) {
      const data = await res.json();
      setTodaysReviews(data.reviews || []);
    }
  };

  const startReviewSession = async (chunkId: string) => {
    const token = await getValidToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    try {
      const res = await fetch(`${backendUrl}/api/reviews/start`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ chunk_id: chunkId }),
      });

      if (res.ok) {
        const data = await res.json();
        // Navigate to review session page
        router.push(`/review/${chunkId}`);
      } else {
        console.error("Failed to start review session");
      }
    } catch (error) {
      console.error("Error starting review session:", error);
    }
  };

  useEffect(() => {
    const init = async () => {
      const token = await getValidToken();
      if (!token) {
        router.replace("/login");
        return;
      }
      await Promise.all([fetchClasses(token), fetchTodaysReviews(token)]);
      setLoading(false);
    };
    init();
  }, [router, fetchClasses]);

  // Fetch all tasks for the visible month when calendar is shown or month changes
  useEffect(() => {
    if (!showCalendar) return;
    const fetchMonthTasks = async () => {
      setMonthTasksLoading(true);
      try {
        const token = await getValidToken();
        if (!token) return;
        const start = startOfMonth(calendarMonth).toISOString().slice(0, 10);
        const end = endOfMonth(calendarMonth).toISOString().slice(0, 10);
        const res = await fetch(`${backendUrl}/api/tasks?start=${start}&end=${end}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setMonthTasks(data.tasks || []);
        }
      } finally {
        setMonthTasksLoading(false);
      }
    };
    fetchMonthTasks();
  }, [showCalendar, calendarMonth]);

  const pendingReviews = todaysReviews.filter(review => !review.completed);

  // Calculate review progress
  const totalReviews = todaysReviews.length;
  const completedReviews = todaysReviews.filter(r => r.completed).length;
  const reviewProgress = totalReviews > 0 ? Math.round((completedReviews / totalReviews) * 100) : 0;

  // Placeholder user info and streak
  const userName = "Student";
  const streak = 5;

  // Calendar logic
  const today = useMemo(() => new Date(), []);
  const weekViewStart = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  }, [today]);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekViewStart);
    d.setDate(d.getDate() + i);
    return d;
  });
  // Gather all tasks for the week
  const allTasks = useMemo(() => {
    return todaysReviews.concat(
      // Optionally, fetch more tasks from backend for the week
      []
    );
  }, [todaysReviews]);
  const tasksByDay: Record<string, ReviewTask[]> = useMemo(() => {
    const map: Record<string, ReviewTask[]> = {};
    for (const t of allTasks) {
      const day = t.scheduled_date;
      if (!map[day]) map[day] = [];
      map[day].push(t);
    }
    return map;
  }, [allTasks]);

  // Calculate all days to display in the month grid (including leading/trailing days for full weeks)
  const monthStart = useMemo(() => startOfMonth(calendarMonth), [calendarMonth]);
  const monthEnd = useMemo(() => endOfMonth(calendarMonth), [calendarMonth]);
  const gridStart = useMemo(() => startOfWeek(monthStart), [monthStart]);
  const gridEnd = useMemo(() => endOfWeek(monthEnd), [monthEnd]);
  const daysInGrid = useMemo(() => {
    const days = [];
    let d = new Date(gridStart);
    while (d.getTime() <= gridEnd.getTime()) {
      days.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return days;
  }, [gridStart, gridEnd]);

  // Gather all tasks for the visible month (for now, just use todaysReviews; ideally fetch all month tasks from backend)
  const tasksByDayMonth: Record<string, ReviewTask[]> = useMemo(() => {
    const map: Record<string, ReviewTask[]> = {};
    for (const t of monthTasks) {
      const day = t.scheduled_date;
      if (!map[day]) map[day] = [];
      map[day].push(t);
    }
    return map;
  }, [monthTasks]);

  // Handler for updating preferences
  const handlePrefsChange = (field: string, value: any) => {
    const newPrefs = { ...preferences, [field]: value };
    setPreferences(newPrefs);
    setUserPreferences(newPrefs);
    // Later: send to backend here
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-5xl flex justify-end mb-4">
        <button
          className={`px-4 py-2 rounded-lg font-semibold mr-2 ${!showCalendar ? "bg-indigo-600 text-white" : "bg-white text-indigo-700 border border-indigo-300"}`}
          onClick={() => setShowCalendar(false)}
        >
          Dashboard
        </button>
        <button
          className={`px-4 py-2 rounded-lg font-semibold ${showCalendar ? "bg-indigo-600 text-white" : "bg-white text-indigo-700 border border-indigo-300"}`}
          onClick={() => setShowCalendar(true)}
        >
          Calendar
        </button>
      </div>
      {showCalendar ? (
        monthTasksLoading ? (
          <div className="w-full max-w-5xl bg-white/90 shadow-2xl rounded-3xl p-8 flex flex-col items-center justify-center text-lg text-indigo-700">Loading calendar...</div>
        ) : (
          <div className="w-full max-w-5xl bg-white/90 shadow-2xl rounded-3xl p-8 flex flex-col gap-6">
            <div className="flex items-center justify-between mb-4">
              <button
                className="px-3 py-1 rounded bg-indigo-100 text-indigo-700 font-bold text-lg hover:bg-indigo-200"
                onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}
              >
                &lt;
              </button>
              <h2 className="text-2xl font-bold text-indigo-700">
                {format(calendarMonth, "MMMM yyyy")}
              </h2>
              <button
                className="px-3 py-1 rounded bg-indigo-100 text-indigo-700 font-bold text-lg hover:bg-indigo-200"
                onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
              >
                &gt;
              </button>
            </div>
            <div className="grid grid-cols-7 gap-2 border rounded-xl overflow-hidden bg-indigo-50">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((wd) => (
                <div key={wd} className="text-center font-semibold py-2 text-indigo-700 border-b border-indigo-200 bg-indigo-100">
                  {wd}
                </div>
              ))}
              {daysInGrid.map((d, i) => (
                <div
                  key={i}
                  className={`flex flex-col border-l first:border-l-0 border-indigo-200 min-h-[100px] ${!isSameMonth(d, calendarMonth) ? "bg-gray-100 text-gray-400" : ""}`}
                >
                  <div className={`text-center font-semibold py-1 ${isSameDay(d, today) ? "text-white bg-indigo-500 rounded-full w-8 mx-auto" : "text-indigo-700"}`}>
                    {d.getDate()}
                  </div>
                  <div className="flex-1 flex flex-col gap-1 p-1">
                    {(tasksByDayMonth[d.toISOString().slice(0, 10)] || []).map((task, idx) => (
                      <div
                        key={task.id + idx}
                        className={`rounded px-1 py-0.5 border text-xs font-semibold shadow-sm ${TASK_COLORS[task.task_type] || "bg-gray-200 border-gray-400 text-gray-800"}`}
                      >
                        {task.task_type.charAt(0).toUpperCase() + task.task_type.slice(1)}
                        {task.completed && <span className="ml-1 text-green-600">✓</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      ) : (
        <>
          <div className="w-full max-w-2xl mb-8">
            <button
              className="bg-indigo-500 text-white px-4 py-2 rounded-lg font-semibold mb-2"
              onClick={() => setShowPrefs((v) => !v)}
            >
              {showPrefs ? "Hide" : "Edit"} Study Preferences
            </button>
            {showPrefs && (
              <div className="bg-white rounded-xl shadow p-6 flex flex-col gap-4">
                <div>
                  <label className="block font-semibold mb-1">Study Days</label>
                  <div className="flex gap-2">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
                      <label key={d} className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={preferences.studyDays.includes(i)}
                          onChange={e => {
                            const newDays = e.target.checked
                              ? [...preferences.studyDays, i]
                              : preferences.studyDays.filter((d: number) => d !== i);
                            handlePrefsChange("studyDays", newDays.sort());
                          }}
                        />
                        {d}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Daily Study Intensity</label>
                  <select
                    className="border rounded px-2 py-1"
                    value={preferences.intensity}
                    onChange={e => handlePrefsChange("intensity", e.target.value)}
                  >
                    <option value="light">Light (10 min/day)</option>
                    <option value="medium">Medium (45 min/day)</option>
                    <option value="hard">Hard (90 min/day)</option>
                  </select>
                </div>
              </div>
            )}
          </div>
          <div className="w-full max-w-5xl bg-white/90 shadow-2xl rounded-3xl p-8 md:p-12 flex flex-col gap-10">
            {/* Welcome Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-2">
              <div>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-indigo-700 mb-1">Welcome back, {userName}!</h1>
                <p className="text-gray-600 text-lg">Here’s your study overview for today.</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-xl">
                  <FaFire className="text-orange-500 text-xl" />
                  <span className="font-bold text-indigo-700">{streak}</span>
                  <span className="text-gray-600">day streak</span>
                </div>
              </div>
            </div>

            {/* Summary Card */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-4">
              <div className="flex flex-col items-center bg-gradient-to-br from-indigo-100 to-blue-50 rounded-2xl shadow p-6">
                <FaBook className="text-indigo-600 text-3xl mb-2" />
                <div className="text-2xl font-bold text-indigo-700">{classes.length}</div>
                <div className="text-gray-600">Classes</div>
              </div>
              <div className="flex flex-col items-center bg-gradient-to-br from-blue-100 to-indigo-50 rounded-2xl shadow p-6">
                <FaCheckCircle className="text-green-500 text-3xl mb-2" />
                <div className="text-2xl font-bold text-indigo-700">{totalReviews}</div>
                <div className="text-gray-600">Reviews Today</div>
              </div>
              <div className="flex flex-col items-center bg-gradient-to-br from-indigo-100 to-blue-50 rounded-2xl shadow p-6">
                <FaFire className="text-orange-500 text-3xl mb-2" />
                <div className="text-2xl font-bold text-indigo-700">{streak}</div>
                <div className="text-gray-600">Day Streak</div>
              </div>
            </div>

            {/* Review Progress Bar */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-2">
                <span className="text-lg font-semibold text-indigo-700">Review Progress</span>
                <span className="text-gray-600 text-sm">{completedReviews} / {totalReviews} completed</span>
              </div>
              <div className="w-full h-4 bg-indigo-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 transition-all"
                  style={{ width: `${reviewProgress}%` }}
                ></div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-10">
              {/* Today's Reviews Section */}
              <div className="flex-1 bg-gradient-to-br from-indigo-50 to-blue-100 rounded-2xl shadow p-6 flex flex-col items-center">
                <h2 className="text-2xl font-bold text-indigo-700 mb-4">Today&apos;s Reviews</h2>
                {pendingReviews.length === 0 ? (
                  <div className="text-gray-500 text-lg">No reviews scheduled for today!</div>
                ) : (
                  <div className="w-full flex flex-col items-center gap-4">
                    <p className="text-gray-700 mb-4 text-lg">
                      You have <span className="font-bold text-indigo-600">{pendingReviews.length}</span> task(s) scheduled for today
                    </p>
                    {pendingReviews.map((task) => (
                      <div key={task.id} className="w-full flex flex-col md:flex-row items-center gap-4 bg-white/80 rounded-lg p-4 shadow">
                        <span className="font-semibold text-indigo-700 capitalize">{task.task_type}</span>
                        <button
                          onClick={() => {
                            if (task.task_type === "learn" || task.task_type === "review") {
                              router.push(`/review/${task.chunk_id}?type=${task.task_type}`);
                            } else if (task.task_type === "quiz") {
                              router.push(`/review/${task.chunk_id}?type=quiz`);
                            }
                          }}
                          className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-semibold shadow hover:bg-indigo-700 transition"
                        >
                          {task.task_type === "learn" && "Go to Learn"}
                          {task.task_type === "review" && "Go to Review"}
                          {task.task_type === "quiz" && "Take Quiz"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* Classes Section */}
              <div className="flex-1 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl shadow p-6">
                <h2 className="text-2xl font-bold text-indigo-700 mb-4">Your Classes</h2>
                {classes.length === 0 ? (
                  <div className="text-gray-500 text-lg">No classes found.</div>
                ) : (
                  <div className="grid gap-6 sm:grid-cols-2">
                    {classes.map(cls => (
                      <div
                        key={cls.id}
                        className="bg-white/80 p-5 rounded-xl shadow hover:shadow-lg cursor-pointer border border-indigo-100 hover:border-indigo-300 transition"
                        onClick={() => router.push(`/class/${cls.id}`)}
                      >
                        <div className="font-bold text-lg text-indigo-800 mb-1">{cls.name}</div>
                        {cls.description && (
                          <div className="text-gray-600 text-sm">{cls.description}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Recent Activity Section (placeholder) */}
            <div className="mt-10">
              <h2 className="text-xl font-bold text-indigo-700 mb-4">Recent Activity</h2>
              <div className="bg-white/80 rounded-xl shadow p-6 text-gray-600 text-center">
                <div className="text-gray-400">No recent activity yet. Complete reviews or add classes to see updates here!</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
} 