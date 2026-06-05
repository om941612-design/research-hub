# Research Hub — Personal Research Assistant

A RAG-based research assistant that lets you upload documents and chat with them using AI.

## Live App
https://intel-quest-station.lovable.app

## Presentation
https://gamma.app/docs/Your-Personal-AI-Research-Assistant-vk0fa63tg9oah0o

## Test Credentials
Use Google Sign-in on the login page.

## Tech Stack
- **Frontend**: Lovable (TanStack Start)
- **Automation**: n8n
- **AI**: Dify (RAG)
- **Database**: Supabase

## Architecture
Webhook → n8n → Dify AI → Supabase → Frontend

## Repo Structure
- `/src` — Frontend source code
- `/backend` — n8n workflow JSONs
- `/supabase` — Database migrations

## n8n Workflows
- `backend/Document Ingest.json` — Handles PDF upload to Dify
- `backend/Chat Query.json` — Handles AI chat queries
