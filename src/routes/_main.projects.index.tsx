import { createFileRoute } from '@tanstack/react-router';
import ProjectList from '../pages/ProjectList';

export const Route = createFileRoute('/_main/projects/')({ component: ProjectList });
