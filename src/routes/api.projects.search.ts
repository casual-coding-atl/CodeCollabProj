import { createFileRoute } from '@tanstack/react-router';
import { handler, json, error, query } from '../server/http';
import { connectDB } from '../server/db';
import { Project } from '../server/models';

/**
 * GET /api/projects/search?query=...  →  projectController.searchProjects
 * Public. 400 when `query` is missing. Matches $or over title/tags/requiredSkills,
 * escaped regex, populate('owner','_id username'), sort({ createdAt: -1 }).
 * STATIC `/search` takes precedence over `/$id` automatically.
 */

function escapeRegExp(value: string): string {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const Route = createFileRoute('/api/projects/search')({
  server: {
    handlers: {
      GET: handler(async ({ request }) => {
        await connectDB();

        const searchQuery = query(request).get('query');
        if (!searchQuery) return error(400, 'Search query is required');

        const safeQuery = escapeRegExp(searchQuery);
        const projects = await Project.find({
          $or: [
            { title: { $regex: safeQuery, $options: 'i' } },
            { tags: { $regex: safeQuery, $options: 'i' } },
            { requiredSkills: { $regex: safeQuery, $options: 'i' } },
          ],
        })
          .populate('owner', '_id username')
          .sort({ createdAt: -1 })
          .exec();

        return json(projects);
      }),
    },
  },
});
