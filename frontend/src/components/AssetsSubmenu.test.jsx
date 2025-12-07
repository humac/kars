import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import AssetsSubmenu from './AssetsSubmenu';

describe('AssetsSubmenu Component', () => {
  it('renders Assets and Dashboard links', () => {
    render(
      <BrowserRouter>
        <AssetsSubmenu />
      </BrowserRouter>
    );

    expect(screen.getByText('Assets')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('highlights Assets link when on /assets route', () => {
    window.history.pushState({}, '', '/assets');
    
    render(
      <BrowserRouter>
        <AssetsSubmenu />
      </BrowserRouter>
    );

    const assetsLink = screen.getByText('Assets');
    expect(assetsLink).toHaveClass('text-sky-600');
  });

  it('highlights Dashboard link when on /assets/dashboard route', () => {
    window.history.pushState({}, '', '/assets/dashboard');
    
    render(
      <BrowserRouter>
        <AssetsSubmenu />
      </BrowserRouter>
    );

    const dashboardLink = screen.getByText('Dashboard');
    expect(dashboardLink).toHaveClass('text-sky-600');
  });
});
