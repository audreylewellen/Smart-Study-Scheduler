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

export default function DashboardPage() {
  const router = useRouter();
  const [classes, setClasses] = useState<Class[]>([]);
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
    setLoading(false);
  };

  useEffect(() => {
    const init = async () => {
      const token = await getValidToken();
      if (!token) {
        router.replace("/login");
        return;
      }
      fetchClasses(token);
    };
    init();
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-2xl font-bold mb-6">Your Classes</h1>
      {loading ? (
        <div>Loading...</div>
      ) : classes.length === 0 ? (
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
  );
} 