"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getValidToken, refreshTokenIfNeeded } from "@/utils/auth";
import { FaBook, FaCheckCircle, FaFire } from "react-icons/fa";

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

export default function DashboardPage() {
  const router = useRouter();
  const [classes, setClasses] = useState<Class[]>([]);
  const [todaysReviews, setTodaysReviews] = useState<ReviewTask[]>([]);
  const [loading, setLoading] = useState(true);

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

  const pendingReviews = todaysReviews.filter(review => !review.completed);

  // Calculate review progress
  const totalReviews = todaysReviews.length;
  const completedReviews = todaysReviews.filter(r => r.completed).length;
  const reviewProgress = totalReviews > 0 ? Math.round((completedReviews / totalReviews) * 100) : 0;

  // Placeholder user info and streak
  const userName = "Student";
  const streak = 5;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center px-4 py-10">
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
              <div className="w-full flex flex-col items-center">
                <p className="text-gray-700 mb-4 text-lg">
                  You have <span className="font-bold text-indigo-600">{pendingReviews.length}</span> review(s) scheduled for today
                </p>
                <button
                  onClick={() => startReviewSession(pendingReviews[0].chunk_id)}
                  className="bg-indigo-600 text-white px-8 py-3 rounded-lg font-semibold text-lg shadow hover:bg-indigo-700 transition"
                >
                  Start Review Session
                </button>
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
    </div>
  );
} 