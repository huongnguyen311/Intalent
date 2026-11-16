import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Popover } from './Popover';

const setup = () =>
  render(
    <Popover trigger={({ toggle }) => <button onClick={toggle}>Open</button>}>
      {() => <div data-testid="panel">item</div>}
    </Popover>,
  );

describe('Popover', () => {
  it('stays open when the panel itself scrolls', () => {
    setup();
    fireEvent.click(screen.getByText('Open'));
    fireEvent.scroll(screen.getByTestId('panel'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('closes when the page scrolls', () => {
    setup();
    fireEvent.click(screen.getByText('Open'));
    fireEvent.scroll(document);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
