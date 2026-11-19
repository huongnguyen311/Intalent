import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Drawer } from './Drawer';
import { Modal } from './Modal';

describe('Drawer keyboard and close behaviour', () => {
  it('moves focus inside, keeps Tab inside and closes on Escape', () => {
    const onClose = vi.fn();
    render(<><button>behind</button><Drawer open title="Panel" onClose={onClose}><input aria-label="first" /><button>last</button></Drawer></>);
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
    screen.getByText('last').focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape closes only the top dialog when a modal sits on a drawer', () => {
    const drawerClose = vi.fn();
    const modalClose = vi.fn();
    render(<Drawer open title="Panel" onClose={drawerClose}><Modal open title="Inner" onClose={modalClose}>x</Modal></Drawer>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(modalClose).toHaveBeenCalledTimes(1);
    expect(drawerClose).not.toHaveBeenCalled();
  });

  it('asks before throwing away unsaved changes', () => {
    const onClose = vi.fn();
    render(<Drawer open title="Panel" onClose={onClose} guardUnsaved><input aria-label="Title" /></Drawer>);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('dialog').parentElement!);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('Discard unsaved changes?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(screen.queryByText('Discard unsaved changes?')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes straight away when nothing changed', () => {
    const onClose = vi.fn();
    render(<Drawer open title="Panel" onClose={onClose} guardUnsaved><input aria-label="Title" /></Drawer>);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('variant="center" opens as a centred dialog and still guards unsaved edits', () => {
    const onClose = vi.fn();
    render(<Drawer open title="Form" onClose={onClose} guardUnsaved variant="center"><input aria-label="Title" /></Drawer>);
    const dialog = screen.getByRole('dialog', { name: 'Form' });
    expect(dialog.parentElement!.className).toContain('justify-center');
    expect(dialog.className).toContain('rounded-xl');
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'x' } });
    fireEvent.click(dialog.parentElement!);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('Discard unsaved changes?')).toBeInTheDocument();
  });

  it('defaults to the right-hand slide-over', () => {
    render(<Drawer open title="Panel" onClose={() => {}}>x</Drawer>);
    expect(screen.getByRole('dialog').parentElement!.className).toContain('justify-end');
  });

  it('returns focus to the opener', () => {
    function Host() {
      const [open, setOpen] = useState(false);
      return <><button onClick={() => setOpen(true)}>open</button><Drawer open={open} title="P" onClose={() => setOpen(false)}><button>in</button></Drawer></>;
    }
    render(<Host />);
    const opener = screen.getByText('open');
    opener.focus();
    fireEvent.click(opener);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.activeElement).toBe(opener);
  });
});
