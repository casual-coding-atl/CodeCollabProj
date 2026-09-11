import { createFileRoute } from '@tanstack/react-router';
import { handler, json, error, requireUser } from '../server/http';
import { connectDB } from '../server/db';
import { Evaluation } from '../server/models';

/**
 * /api/evaluations/$id
 *   GET → fetch a single evaluation (owner only — evaluations are private)
 */
export const Route = createFileRoute('/api/evaluations/$id')({
  server: {
    handlers: {
      GET: handler(async ({ request, params }) => {
        const user = await requireUser(request);
        await connectDB();

        const evaluation = await Evaluation.findById(params.id).exec();
        if (!evaluation) return error(404, 'Evaluation not found');

        // Evaluations are private: only the user who requested it may read it.
        if (String(evaluation.userId) !== String(user._id)) {
          return error(403, 'Not authorised to view this evaluation');
        }

        return json(evaluation);
      }),
    },
  },
});
