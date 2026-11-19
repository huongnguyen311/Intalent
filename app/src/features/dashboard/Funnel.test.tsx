import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Stage } from '../../domain/types';
import { Funnel } from './Funnel';

// Strictly falling counts, so no optional stage is folded away as a pass-through.
const funnelOf = (stages: Stage[]) => stages.map((stage, i) => ({ stage, reached: 100 - i * 7 }));

describe('Conversion funnel', () => {
  it('draws one bar per stage when the steps fit across the panel', () => {
    render(<Funnel funnel={funnelOf(['new', 'screening', 'interview', 'final_interview', 'offer', 'hired'])} />);
    expect(screen.getByTestId('funnel-bars').children).toHaveLength(6);
    expect(screen.getByTestId('funnel-rows')).toHaveClass('sm:hidden');
  });

  it('falls back to rows at every width when there are too many stages for bars', () => {
    const many: Stage[] = ['new', 'ai_screening', 'screening', 'interview', 'assessment', 'final_interview', 'custom_1', 'custom_2', 'offer', 'hired'];
    render(<Funnel funnel={funnelOf(many)} />);
    expect(screen.queryByTestId('funnel-bars')).toBeNull();
    expect(screen.getByTestId('funnel-rows').children).toHaveLength(10);
    expect(screen.getByTestId('funnel-rows')).not.toHaveClass('sm:hidden');
  });

  it('leaves out an optional stage nobody stopped at', () => {
    render(<Funnel funnel={[{ stage: 'new', reached: 10 }, { stage: 'ai_screening', reached: 8 }, { stage: 'screening', reached: 8 }, { stage: 'hired', reached: 2 }]} />);
    expect(screen.getByTestId('funnel-rows').children).toHaveLength(3);
  });
});
