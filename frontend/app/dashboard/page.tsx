"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getValidToken, refreshTokenIfNeeded } from "@/utils/auth";

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
  }, [router]);

  const pendingReviews = todaysReviews.filter(review => !review.completed);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      
      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="space-y-8">
          {/* Today's Reviews Section */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Today's Reviews</h2>
            {pendingReviews.length === 0 ? (
              <div className="bg-white p-4 rounded shadow border">
                <p className="text-gray-600">No reviews scheduled for today!</p>
              </div>
            ) : (
              <div className="bg-white p-4 rounded shadow border">
                <p className="text-gray-600 mb-3">
                  You have {pendingReviews.length} review(s) scheduled for today
                </p>
                <button
                  onClick={() => startReviewSession(pendingReviews[0].chunk_id)}
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
                >
                  Start Review Session
                </button>
              </div>
            )}
          </div>

          {/* Classes Section */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Your Classes</h2>
            {classes.length === 0 ? (
              <div>No classes found.</div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                {classes.map(cls => (
                  <div
                    key={cls.id}
                    className="bg-white p-4 rounded shadow hover:shadow-md cursor-pointer border"
                    onClick={() => router.push(`/class/${cls.id}`)}
                  >
                    <div className="font-semibold text-lg mb-1">{cls.name}</div>
                    {cls.description && (
                      <div className="text-gray-600 text-sm">{cls.description}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 