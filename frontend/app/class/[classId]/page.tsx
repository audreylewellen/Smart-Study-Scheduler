"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

interface Class {
  id: string;
  name: string;
  description?: string;
}

export default function ClassDetailPage() {
  const router = useRouter();
  const params = useParams();
  const classId = params?.classId as string;
  const [classInfo, setClassInfo] = useState<Class | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      router.replace("/login");
      return;
    }
    if (!classId) return;
    fetch(`${backendUrl}/api/classes/${classId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => {
        setClassInfo(data.class || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [classId, router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const handleUpload = async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token || !selectedFiles.length) {
      router.replace("/login");
      return;
    }
    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append("class_id", classId);
    formData.append("study_days", JSON.stringify([0, 1, 2, 3, 4])); 
    formData.append("intensity", "light");
    selectedFiles.forEach((file) => {
      formData.append("pdfs", file, file.name);
    });
    try {
      const res = await fetch(`${backendUrl}/upload-batch`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;
  if (!classInfo) return <div className="p-8">Class not found.</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto bg-white rounded shadow p-6">
        <h1 className="text-2xl font-bold mb-2">{classInfo.name}</h1>
        {classInfo.description && (
          <div className="mb-4 text-gray-600">{classInfo.description}</div>
        )}
        <div className="mb-6">
          <label className="block mb-2 font-medium">Upload Lecture PDFs</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            multiple
            onChange={handleFileChange}
            className="mb-2"
          />
          <button
            onClick={handleUpload}
            disabled={uploading || !selectedFiles.length}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Upload"}
          </button>
          {error && <div className="text-red-600 mt-2 text-sm">{error}</div>}
          {selectedFiles.length > 0 && (
            <div className="mt-4">
              <div className="font-semibold mb-1 text-sm">Files to upload (order preserved):</div>
              <ol className="list-decimal ml-5 text-sm">
                {selectedFiles.map((file, idx) => (
                  <li key={idx}>{file.name}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 