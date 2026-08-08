# Job Application Dashboard

Personal job-intelligence system for job discovery, hard-eligibility filtering, relevance ranking, application preparation, and outcome tracking.

## Current milestone

Phase 1 includes:

- Supabase/Postgres schema
- provider-agnostic job-source interface
- deterministic prefilter/scoring logic
- AI prompt contracts
- secure environment-variable template
- interactive dependency-free dashboard prototype

The prototype intentionally uses mock data so it can run before any external credentials are added.

## Prototype

Open `prototype/index.html` directly in a browser, or serve the `prototype/` folder with any static file server.

## External services

Copy `.env.example` to `.env.local` only when integrations are enabled. Never commit `.env.local` or real secret values.

## Intended production stack

Next.js on Vercel + Supabase + OpenAI, with Gmail OAuth and optional job-source adapters such as public ATS feeds or Apify.

## Safety principle

A high semantic match cannot override a hard eligibility blocker. Resume generation is constrained to facts in the canonical candidate profile.
