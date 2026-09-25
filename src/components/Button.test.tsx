import { render, screen } from '@/testing';

import Button from './Button';

describe('Button', () => {
  // Test sound, Undo, Take it and every action chip are 32 px to see. The
  // area that answers a tap reaches past them, to 44 px, so the
  // chip keeps its size. jsdom does no hit-testing, so the classes that make
  // the area are what is asserted.
  it('gives a small button a 44 px tap area around its 32 px chip', () => {
    render(<Button type="small">Undo</Button>);
    expect(screen.getByRole('button', { name: 'Undo' })).toHaveClass(
      'relative',
      'min-h-8',
      'after:absolute',
      'after:-inset-y-[7px]'
    );
  });
});
