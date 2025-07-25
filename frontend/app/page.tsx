import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center px-4">
      <header className="w-full max-w-4xl flex justify-between items-center py-8">
        <div className="flex items-center gap-2">
          <span className="text-3xl font-extrabold text-indigo-700 tracking-tight">StudySync</span>
        </div>
      </header>
      <main className="flex-1 flex flex-col items-center justify-center text-center">
        <h1 className="text-5xl sm:text-6xl font-extrabold text-gray-900 mb-6 leading-tight">
          Smarter Studying.<br />
          <span className="text-indigo-600">Better Recall.</span>
        </h1>
        <p className="text-lg sm:text-xl text-gray-700 max-w-2xl mb-8">
          StudySync helps you master your courses with AI-powered scheduling, spaced repetition, and active recall. Upload your notes, get personalized review plans, and boost your memory—effortlessly.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/signup" className="bg-indigo-600 text-white px-8 py-3 rounded-lg text-lg font-semibold shadow hover:bg-indigo-700 transition">Sign Up</Link>
          <Link href="/login" className="bg-white text-indigo-700 border border-indigo-600 px-8 py-3 rounded-lg text-lg font-semibold shadow hover:bg-indigo-50 transition">Login</Link>
        </div>
      </main>
      <footer className="w-full max-w-4xl py-6 flex justify-center text-gray-500 text-sm">
        &copy; {new Date().getFullYear()} StudySync. All rights reserved.
      </footer>
    </div>
  );
}
