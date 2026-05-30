import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import ThemeToggle from './ThemeToggle.svelte';
import { theme } from '$lib/stores/theme';

describe('ThemeToggle', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.dataset.theme = 'dark';
    theme.set('dark');
  });

  it('toggles the persisted document theme and accessible label', async () => {
    const user = userEvent.setup();

    render(ThemeToggle);

    const button = screen.getByRole('button', { name: /switch to light theme/i });
    expect(document.documentElement.dataset.theme).toBe('dark');

    await user.click(button);

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(window.localStorage.getItem('bigbrain-theme')).toBe('light');
    expect(screen.getByRole('button', { name: /switch to dark theme/i })).toBeInTheDocument();
  });
});
