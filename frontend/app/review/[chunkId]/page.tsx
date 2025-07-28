"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { getValidToken, refreshTokenIfNeeded } from "@/utils/auth";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

interface ReviewSession {
  chunk_text: string;
  chunk_id: string;
  quiz_question?: string;
}

export default function ReviewSessionPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const chunkId = params.chunkId as string;
  const type = searchParams.get("type") || "review";
  
  const [reviewSession, setReviewSession] = useState<ReviewSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quizAnswer, setQuizAnswer] = useState("");
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizFeedback, setQuizFeedback] = useState<string | null>(null);
  const [quizQuestion, setQuizQuestion] = useState<string | null>(null);

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
          body: JSON.stringify({ chunk_id: chunkId, type }),
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
              body: JSON.stringify({ chunk_id: chunkId, type }),
            });
            
            if (retryRes.ok) {
              const data = await retryRes.json();
              setReviewSession(data);
              if (data.quiz_question) setQuizQuestion(data.quiz_question);
            } else {
              setError("Failed to load review session");
            }
          } else {
            router.replace("/login");
          }
        } else if (res.ok) {
          const data = await res.json();
          setReviewSession(data);
          if (data.quiz_question) setQuizQuestion(data.quiz_question);
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
  }, [chunkId, router, type]);

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

  const handleQuizSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setQuizSubmitted(true);
    setQuizFeedback(null);
    const token = await getValidToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    try {
      const res = await fetch(`${backendUrl}/api/quiz/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ chunk_id: chunkId, answer: quizAnswer, quiz_question: quizQuestion }),
      });
      if (res.ok) {
        const data = await res.json();
        setQuizFeedback(data.feedback || "Quiz submitted!");
      } else {
        setQuizFeedback("Failed to submit quiz answer.");
      }
    } catch (error) {
      setQuizFeedback("Error submitting quiz answer.");
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
            <h1 className="text-2xl font-bold">
              {type === "learn" && "Learn Session"}
              {type === "review" && "Review Session"}
              {type === "quiz" && "Quiz Session"}
            </h1>
            <button
              onClick={() => router.push("/dashboard")}
              className="text-gray-500 hover:text-gray-700"
            >
              Back to Dashboard
            </button>
          </div>

          {type === "learn" && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-4">Study Material</h2>
              <div className="bg-gray-50 p-6 rounded-lg border">
                <div className="whitespace-pre-wrap text-gray-800 leading-relaxed">
                  {reviewSession.chunk_text}
                </div>
              </div>
            </div>
          )}

          {(type === "quiz" || type === "review") && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-4">Quiz</h2>
              {quizQuestion && (
                <div className="bg-indigo-50 p-4 rounded-lg border mb-4">
                  <div className="font-semibold text-indigo-800">{quizQuestion}</div>
                </div>
              )}
              <div className="bg-gray-50 p-6 rounded-lg border mb-4">
                <div className="whitespace-pre-wrap text-gray-800 leading-relaxed">
                  {reviewSession.chunk_text}
                </div>
              </div>
              {!quizSubmitted ? (
                <form onSubmit={handleQuizSubmit} className="flex flex-col gap-4">
                  <textarea
                    className="w-full border border-gray-300 rounded-lg p-3"
                    rows={4}
                    placeholder="Type your answer here..."
                    value={quizAnswer}
                    onChange={e => setQuizAnswer(e.target.value)}
                    required
                    disabled={quizSubmitted}
                  />
                  <button
                    type="submit"
                    className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors"
                    disabled={quizSubmitted}
                  >
                    Submit Answer
                  </button>
                </form>
              ) : (
                <div className="flex flex-col items-center gap-4 mt-4">
                  {quizFeedback === "Correct!" ? (
                    <>
                      <div className="text-green-600 text-lg font-bold">Correct!</div>
                      <button
                        className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors"
                        onClick={() => router.push("/dashboard")}
                      >
                        Next Task
                      </button>
                    </>
                  ) : quizFeedback ? (
                    <>
                      <div className="text-red-600 text-lg font-bold">Incorrect</div>
                      <div className="text-gray-800 text-base text-center">{quizFeedback}</div>
                      <button
                        className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors"
                        onClick={() => router.push("/dashboard")}
                      >
                        Next Task
                      </button>
                    </>
                  ) : null}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-center space-x-4">
            {(type === "learn" || type === "review") && (
              <>
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
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 