"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { getValidToken, refreshTokenIfNeeded } from "@/utils/auth";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

interface ReviewSession {
  chunk_text: string;
  chunk_id: string;
}

export default function ReviewSessionPage() {
  const router = useRouter();
  const params = useParams();
  const chunkId = params.chunkId as string;
  
  const [reviewSession, setReviewSession] = useState<ReviewSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const token = await getValidToken();
      if (!token) {
        router.replace("/login");
        return;
      }

      if (!chunkId) {
        setError("No chunk ID provided");
        setLoading(false);
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

        if (res.status === 401) {
          const newToken = await refreshTokenIfNeeded();
          if (newToken) {
            const retryRes = await fetch(`${backendUrl}/api/reviews/start`, {
              method: "POST",
              headers: { 
                "Content-Type": "application/json",
                Authorization: `Bearer ${newToken}`
              },
              body: JSON.stringify({ chunk_id: chunkId }),
            });
            
            if (retryRes.ok) {
              const data = await retryRes.json();
              setReviewSession(data);
            } else {
              setError("Failed to load review session");
            }
          } else {
            router.replace("/login");
          }
        } else if (res.ok) {
          const data = await res.json();
          setReviewSession(data);
        } else {
          setError("Failed to load review session");
        }
      } catch (err) {
        setError("Error loading review session");
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [chunkId, router]);

  const handleCompleteReview = async () => {
    const token = await getValidToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    try {
      const res = await fetch(`${backendUrl}/api/reviews/complete`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ chunk_id: chunkId }),
      });

      if (res.ok) {
        // Review completed successfully, go back to dashboard
        router.push("/dashboard");
      } else {
        console.error("Failed to complete review");
      }
    } catch (error) {
      console.error("Error completing review:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div>Loading review session...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  if (!reviewSession) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div>No review session found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">Review Session</h1>
            <button
              onClick={() => router.push("/dashboard")}
              className="text-gray-500 hover:text-gray-700"
            >
              Back to Dashboard
            </button>
          </div>

          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-4">Study Material</h2>
            <div className="bg-gray-50 p-6 rounded-lg border">
              <div className="whitespace-pre-wrap text-gray-800 leading-relaxed">
                {reviewSession.chunk_text}
              </div>
            </div>
          </div>

          <div className="flex justify-center space-x-4">
            <button
              onClick={handleCompleteReview}
              className="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 transition-colors"
            >
              Mark as Reviewed
            </button>
            <button
              onClick={() => router.push("/dashboard")}
              className="bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600 transition-colors"
            >
              Skip for Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 