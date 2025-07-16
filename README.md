# Smart Study Scheduler with Embedding Recall

A personalized, intelligent study planner that helps students retain information more effectively using document embeddings, spaced repetition, and active recall.

---

## Overview

This tool enables students to upload their study materials (PDFs, notes, slides), extract and embed meaningful content segments, and receive personalized, timeline-aware study schedules. It supports recall-based learning through spaced repetition, daily review sessions, and performance-based scheduling.

---

## Key Features

- Upload personal study materials and notes
- Automatic chunking and semantic embedding of content
- Daily review sessions based on spaced repetition and memory modeling
- Lightweight feedback system to track understanding and adjust review intervals
- Cross-platform reminders and calendar integration
- Optional AI-generated recall questions and explanations

---

## Tech Stack

| Layer           | Technology                                  |
|------------------|--------------------------------------------|
| Frontend         | React, Tailwind CSS                        |
| Backend          | FastAPI (Python)                           |
| Authentication   | Supabase Auth                              |
| Embeddings       | OpenAI, pluggable with Hugging Face models |
| Vector Store     | pgvector                                   |
| Database         | PostgreSQL via Supabase                    |

---

## Project Status

Current progress:
- [X] Document upload and chunking
- [X] Embedding pipeline
- [ ] Review session basis
- [ ] Feedback loop and memory model integration
- [ ] Calendar integration and scheduling logic
- [ ] AI-powered recall prompt generation

---

## Folder Structure

```
smart-study-scheduler/
├── backend/            # FastAPI backend logic and APIs
├── frontend/           # React frontend application
├── tests/              # Unit and integration tests
└── .gitignore, README.md, etc.
```
