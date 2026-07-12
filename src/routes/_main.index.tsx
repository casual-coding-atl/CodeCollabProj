import { createFileRoute } from '@tanstack/react-router';
import Home from '../pages/Home';

export const Route = createFileRoute('/_main/')({ component: Home });
