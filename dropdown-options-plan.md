# Plan: Split & Expand Project Form Dropdown Options

## Overview

The project creation/edit form uses a single `commonSkills` array (defined inline
in `ProjectFormFields`) as the suggestion list for both the **Technologies Used**
and **Required Skills** combobox fields. The list is outdated (12 generic entries,
nothing AI/ML-related) and is the same for both fields, which conflates two
different concepts.

**Goal:** Replace the shared array with two purpose-built, non-overlapping lists —
one for technologies (frameworks, tools, platforms, environments) and one for
skills (disciplines, competencies, practices) — each capped at 50 entries with
no item appearing in both lists.

**Scope:** One file only — `src/components/projects/ProjectForm.tsx`.  
No schema, API, or database changes are needed; these are frontend suggestion
lists, not validated enums.

---

## Sub-Tasks

---

### Sub-Task 1 — Replace `commonSkills` with two separate option lists

**Intent**  
Remove the single `commonSkills` array and introduce `TECHNOLOGY_OPTIONS` and
`SKILL_OPTIONS` constants in its place. Pass the correct list to each
`ComboboxTagEditor` — technologies to the Technologies field, skills to the
Required Skills field. No item appears in both lists.

**Expected Outcomes**
- The Technologies Used combobox suggests concrete tools, frameworks, platforms,
  languages, and environments (things you *build with* or *run on*).
- The Required Skills combobox suggests disciplines, competencies, and practices
  (things a collaborator *knows how to do*). No language or tool name repeats here.
- Both lists contain exactly 50 entries with zero overlap between them.
- Tags combobox is unchanged (no `options` prop).
- Users can still type a free-form value not in either list.

**Todo List**
1. In `ProjectFormFields`, delete the `commonSkills` array (lines 304–317).
2. Add a `TECHNOLOGY_OPTIONS` constant at module level (above the component)
   with exactly 50 entries — tools, languages, frameworks, platforms, IDEs, and
   AI services that belong to the "what the project is built with" category:

   Languages & Runtimes:
   JavaScript, TypeScript, Python, Java, Go, Rust, C#, Swift, Kotlin, Ruby

   Frontend Frameworks:
   React, Next.js, Vue.js, Svelte, Angular

   Backend Frameworks:
   Node.js, Express, FastAPI, Django, Flask, Hono

   AI / LLM Platforms & APIs:
   OpenAI API, Anthropic Claude API, Google Gemini API, Azure AI, AWS Bedrock,
   Hugging Face, Ollama, Mistral AI, Cohere

   Agentic Frameworks & SDKs:
   LangChain, LlamaIndex, LangGraph, CrewAI, AutoGen, Google ADK,
   Pydantic AI, Vercel AI SDK

   Databases & Storage:
   MongoDB, PostgreSQL, Redis, Pinecone, Weaviate, pgvector, Supabase, Firebase

   Dev Tools & Environments:
   VS Code, Cursor, Docker, Git, GitHub Actions

   Cloud & Hosting:
   AWS, Google Cloud, Azure, Vercel, Railway

   (Total: 10+5+6+9+8+8+5+5 = 56 — trim to exactly 50 before implementing.
   Trim from the least-used in each group. Suggested cuts: Ruby, Kotlin, Swift,
   Hono, Mistral AI, Cohere — leaves 50.)

3. Add a `SKILL_OPTIONS` constant at module level with exactly 50 entries —
   disciplines and competencies only, no language or tool names from
   TECHNOLOGY_OPTIONS:

   AI / ML Disciplines:
   Machine Learning, Deep Learning, Natural Language Processing, Computer Vision,
   Reinforcement Learning, LLM Fine-tuning,
   RAG (Retrieval-Augmented Generation), Prompt Engineering, Embeddings & Vector Search,
   Agentic AI Development, Multi-Agent Systems, AI Safety & Alignment

   Software Engineering:
   Full-Stack Development, Frontend Development, Backend Development,
   Mobile Development, API Design, Database Design,
   System Architecture, Microservices, Real-Time Systems

   Data:
   Data Engineering, Data Science, Data Analysis, ETL Pipelines, Data Visualization

   DevOps & Infrastructure:
   DevOps, CI/CD, Cloud Architecture, Infrastructure as Code,
   Containerization, Site Reliability Engineering

   Security & Quality:
   Application Security, Performance Optimization, Testing & QA,
   Accessibility, Code Review

   Product & Design:
   UI/UX Design, Product Management, Technical Writing, Agile / Scrum,
   Open Source Contribution

   Soft / Cross-Cutting:
   Technical Leadership, Mentoring, Research, Documentation,
   Community Building, Pair Programming

   (Total: 12+9+5+6+5+5+6 = 48 — add 2 more to reach 50. Suggested additions:
   Workflow Automation, Observability & Monitoring.)

4. Update the `ComboboxTagEditor` for `technologies` to pass
   `options={TECHNOLOGY_OPTIONS}`.
5. Update the `ComboboxTagEditor` for `requiredSkills` to pass
   `options={SKILL_OPTIONS}`.

**Relevant Context**
- File: `src/components/projects/ProjectForm.tsx`
- Current array: `commonSkills` defined at line 304 inside `ProjectFormFields`
- Technologies field: `ComboboxTagEditor` at line 509, currently `options={commonSkills}`
- Required Skills field: `ComboboxTagEditor` at line 518, currently `options={commonSkills}`
- The `ComboboxTagEditor` component accepts an optional `options?: string[]` prop;
  users can still type a free-form value not in the list.
- Constants must be module-level (above the component) so they are not
  re-created on every render.
- Zero overlap rule: before finalising the lists, verify no string appears in both.

**Status:** [x] done
