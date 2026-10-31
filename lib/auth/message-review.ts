import { isAdmin, requireAdmin } from './roles';

// Message review and AI costs are administrative features in every environment.
export const canReviewMessages = isAdmin;
export const requireMessageReviewer = requireAdmin;
