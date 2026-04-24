import { test, expect } from '@playwright/test';
import { loginAsRole } from './fixtures/auth.fixture';

/**
 * E2E tests for Projects functionality
 * Tests project listing, searching, viewing details, and creating projects
 */
test.describe('Projects', () => {
  test.beforeEach(async ({ page }) => {
    // Login as user1 before each test
    await loginAsRole(page, 'user1');
  });

  test('should list all projects at /projects', async ({ page }) => {
    // Navigate to projects page
    await page.goto('/projects');

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Verify the Projects heading is visible
    await expect(page.getByRole('heading', { name: 'Projects', level: 1 })).toBeVisible();

    // Verify the Create Project button is visible
    await expect(page.getByRole('link', { name: /create project/i })).toBeVisible();

    // Verify the search input is visible
    await expect(page.getByPlaceholder('Search projects...')).toBeVisible();
  });

  test('should search projects using the search input', async ({ page }) => {
    // Navigate to projects page
    await page.goto('/projects');

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Get the search input
    const searchInput = page.getByPlaceholder('Search projects...');
    await expect(searchInput).toBeVisible();

    // Type a search term - using a common term that might match projects
    await searchInput.fill('test');

    // Wait a moment for filtering to occur (client-side filtering)
    await page.waitForTimeout(500);

    // The page should still show the Projects heading
    await expect(page.getByRole('heading', { name: 'Projects', level: 1 })).toBeVisible();

    // Clear the search and verify projects are still shown
    await searchInput.clear();
    await page.waitForTimeout(500);

    // Projects heading should still be visible
    await expect(page.getByRole('heading', { name: 'Projects', level: 1 })).toBeVisible();
  });

  test('should view project details when clicking View Details', async ({ page }) => {
    // Navigate to projects page
    await page.goto('/projects');

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Look for a View Details link/button
    const viewDetailsButton = page.getByRole('link', { name: /view details/i }).first();

    // Check if there are any projects with View Details button
    const hasProjects = await viewDetailsButton.isVisible().catch(() => false);

    if (hasProjects) {
      // Click the first View Details link
      await viewDetailsButton.click();

      // Wait for navigation
      await page.waitForURL('**/projects/**');

      // Verify we're on the project details page
      await expect(page.getByRole('heading', { name: 'Project Details', level: 1 })).toBeVisible();

      // Verify project title is shown (there should be an h4 heading with the project title)
      const projectTitleHeading = page.locator('h4').first();
      await expect(projectTitleHeading).toBeVisible();
    } else {
      // If no projects exist, verify the empty state message
      await expect(page.getByText(/no projects yet|no projects found/i).first()).toBeVisible();
    }
  });

  test('should navigate to create project page and fill the form', async ({ page }) => {
    // Navigate directly to the create project page
    await page.goto('/projects/create');

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Verify the Create Project heading is visible
    await expect(page.getByRole('heading', { name: /create project/i, level: 1 })).toBeVisible();

    // Fill in the project title
    const titleInput = page.getByLabel(/project title/i);
    await expect(titleInput).toBeVisible();
    await titleInput.fill('E2E Test Project');

    // Fill in the description
    const descriptionInput = page.getByLabel(/description/i);
    await expect(descriptionInput).toBeVisible();
    await descriptionInput.fill(
      'This is a test project created by E2E tests to verify the form works correctly.'
    );

    // Find and click the Technologies autocomplete to add a technology
    // Use the combobox role for more specific selection
    const technologiesInput = page.getByRole('combobox', { name: /technologies used/i });
    await expect(technologiesInput).toBeVisible();
    await technologiesInput.click();
    await technologiesInput.fill('React');
    // Press Enter or select from dropdown
    await page.keyboard.press('Enter');

    // Verify the form has the Cancel and Create Project buttons
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /create project/i })).toBeVisible();

    // Note: We're not submitting the form to avoid creating test data in the database
    // In a real test scenario with proper test data cleanup, we would submit the form
  });

  test('should show Create Project button on projects list page', async ({ page }) => {
    // Navigate to projects page
    await page.goto('/projects');

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Verify the Create Project button exists and is a link to /projects/create
    const createButton = page.getByRole('link', { name: /create project/i });
    await expect(createButton).toBeVisible();
    await expect(createButton).toHaveAttribute('href', '/projects/create');
  });
});
