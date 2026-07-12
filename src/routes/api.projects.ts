import { createFileRoute } from '@tanstack/react-router';
import { handler, json, requireUser, query } from '../server/http';
import { connectDB } from '../server/db';
import { Project } from '../server/models';

/**
 * /api/projects
 *   GET  → projectController.getAllProjects  (+ projectsService.getAll filters)
 *   POST → projectController.createProject
 *
 * NOTE: the legacy Express getAllProjects IGNORED all query params and always
 * returned every project. projectsService (getAll/getByStatus/getFeatured)
 * however sends status/technologies/tags/search/featured, and this port was
 * asked to honour them, so filtering is applied here as an additive superset.
 * Same populate('owner','_id username') + sort({ createdAt: -1 }) + raw-doc shape.
 */

// Escape regex metacharacters so a search term matches literally (prevents ReDoS).
function escapeRegExp(value: string): string {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const Route = createFileRoute('/api/projects')({
  server: {
    handlers: {
      GET: handler(async ({ request }) => {
        await connectDB();

        const q = query(request);
        const status = q.get('status');
        const technologies = q.get('technologies');
        const tags = q.get('tags');
        const search = q.get('search');
        const featured = q.get('featured');

        const filter: Record<string, unknown> = {};
        if (status) filter.status = status;
        if (technologies) filter.technologies = { $in: technologies.split(',') };
        if (tags) filter.tags = { $in: tags.split(',') };
        if (featured === 'true') filter.featured = true;
        if (search) {
          const safe = escapeRegExp(search);
          filter.$or = [
            { title: { $regex: safe, $options: 'i' } },
            { tags: { $regex: safe, $options: 'i' } },
            { requiredSkills: { $regex: safe, $options: 'i' } },
          ];
        }

        const projects = await Project.find(filter)
          .populate('owner', '_id username')
          .sort({ createdAt: -1 })
          .exec();

        return json(projects);
      }),

      POST: handler(async ({ request }) => {
        const user = await requireUser(request);
        await connectDB();

        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

        // Mirror projectValidator (create): title + description required.
        const errors: Array<{ type: string; msg: string; path: string; location: string }> = [];
        const title = typeof body.title === 'string' ? body.title.trim() : '';
        const description = typeof body.description === 'string' ? body.description.trim() : '';
        if (!title) {
          errors.push({ type: 'field', msg: 'Title is required', path: 'title', location: 'body' });
        } else if (title.length < 3 || title.length > 100) {
          errors.push({
            type: 'field',
            msg: 'Title must be between 3 and 100 characters',
            path: 'title',
            location: 'body',
          });
        }
        if (!description) {
          errors.push({
            type: 'field',
            msg: 'Description is required',
            path: 'description',
            location: 'body',
          });
        } else if (description.length < 10 || description.length > 2000) {
          errors.push({
            type: 'field',
            msg: 'Description must be between 10 and 2000 characters',
            path: 'description',
            location: 'body',
          });
        }
        if (
          body.status !== undefined &&
          !['ideation', 'in_progress', 'completed'].includes(body.status as string)
        ) {
          errors.push({
            type: 'field',
            msg: 'Invalid project status',
            path: 'status',
            location: 'body',
          });
        }
        if (errors.length > 0) return json({ errors }, 400);

        const { technologies, githubUrl, liveUrl, requiredSkills, tags, resources, incentives } =
          body;

        // Parse technologies (accepts a JSON string or an array), mirroring the controller.
        let parsedTechnologies: unknown[] = [];
        if (technologies) {
          if (typeof technologies === 'string') {
            try {
              parsedTechnologies = JSON.parse(technologies);
            } catch {
              parsedTechnologies = [technologies];
            }
          } else {
            parsedTechnologies = Array.isArray(technologies) ? technologies : [technologies];
          }
        }

        // Parse incentives (same default object as the controller).
        let parsedIncentives: unknown = {
          enabled: false,
          type: 'recognition',
          description: '',
          amount: 0,
          currency: 'USD',
          equityPercentage: 0,
          customReward: '',
        };
        if (incentives) {
          try {
            parsedIncentives =
              typeof incentives === 'string' ? JSON.parse(incentives) : incentives;
          } catch {
            /* keep defaults */
          }
        }

        const project = await Project.create({
          title,
          description,
          image: null,
          technologies: parsedTechnologies,
          githubUrl,
          liveUrl,
          requiredSkills,
          tags,
          resources,
          incentives: parsedIncentives,
          owner: user._id,
        });

        await project.populate('owner', '_id username');

        return json(project, 201);
      }),
    },
  },
});
