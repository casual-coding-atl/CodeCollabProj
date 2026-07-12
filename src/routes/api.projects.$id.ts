import { createFileRoute } from '@tanstack/react-router';
import { handler, json, error, requireUser } from '../server/http';
import { connectDB } from '../server/db';
import { Project } from '../server/models';

/**
 * /api/projects/$id
 *   GET    → projectController.getProjectById  (public)
 *   PUT    → projectController.updateProject    (owner only)
 *   DELETE → projectController.deleteProject     (owner only)
 *
 * Raw Mongoose docs are returned so `_id` + populated owner/collaborators are
 * preserved, matching Express + the client `Project` type.
 */
export const Route = createFileRoute('/api/projects/$id')({
  server: {
    handlers: {
      GET: handler(async ({ params }) => {
        await connectDB();

        const project = await Project.findById(params.id)
          .populate('owner', '_id username')
          .populate('collaborators.userId', '_id username')
          .exec();

        if (!project) return error(404, 'Project not found');
        return json(project);
      }),

      PUT: handler(async ({ request, params }) => {
        const user = await requireUser(request);
        await connectDB();

        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

        // Mirror projectUpdateValidator (all fields optional).
        const errors: Array<{ type: string; msg: string; path: string; location: string }> = [];
        if (typeof body.title === 'string') {
          const t = body.title.trim();
          if (t.length < 3 || t.length > 100) {
            errors.push({
              type: 'field',
              msg: 'Title must be between 3 and 100 characters',
              path: 'title',
              location: 'body',
            });
          }
        }
        if (typeof body.description === 'string') {
          const d = body.description.trim();
          if (d.length < 10 || d.length > 2000) {
            errors.push({
              type: 'field',
              msg: 'Description must be between 10 and 2000 characters',
              path: 'description',
              location: 'body',
            });
          }
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

        const project = await Project.findById(params.id).exec();
        if (!project) return error(404, 'Project not found');

        // Owner-only.
        if (String(project.owner) !== String(user._id)) {
          return error(403, 'Not authorized to update this project');
        }

        const {
          title,
          description,
          status,
          requiredSkills,
          tags,
          resources,
          technologies,
          githubUrl,
          liveUrl,
          incentives,
        } = body;

        const updateFields: Record<string, unknown> = {};
        if (title) updateFields.title = title;
        if (description) updateFields.description = description;
        if (status) updateFields.status = status;
        if (githubUrl !== undefined) updateFields.githubUrl = githubUrl;
        if (liveUrl !== undefined) updateFields.liveUrl = liveUrl;

        if (requiredSkills !== undefined) {
          updateFields.requiredSkills = Array.isArray(requiredSkills) ? requiredSkills : [];
        }
        if (tags !== undefined) {
          updateFields.tags = Array.isArray(tags) ? tags : [];
        }
        if (technologies !== undefined) {
          updateFields.technologies = Array.isArray(technologies) ? technologies : [];
        }
        if (resources !== undefined) {
          updateFields.resources = Array.isArray(resources) ? resources : [];
        }

        if (incentives !== undefined) {
          try {
            updateFields.incentives =
              typeof incentives === 'string' ? JSON.parse(incentives) : incentives;
          } catch {
            updateFields.incentives = {
              enabled: false,
              type: 'recognition',
              description: '',
              amount: 0,
              currency: 'USD',
              equityPercentage: 0,
              customReward: '',
            };
          }
        }

        const updatedProject = await Project.findByIdAndUpdate(
          params.id,
          { $set: updateFields },
          { new: true },
        )
          .populate('owner', '_id username')
          .exec();

        return json(updatedProject);
      }),

      DELETE: handler(async ({ request, params }) => {
        const user = await requireUser(request);
        await connectDB();

        const project = await Project.findById(params.id).exec();
        if (!project) return error(404, 'Project not found');

        // Owner-only.
        if (String(project.owner) !== String(user._id)) {
          return error(403, 'Not authorized to delete this project');
        }

        await project.deleteOne();
        return json({ message: 'Project deleted successfully' });
      }),
    },
  },
});
