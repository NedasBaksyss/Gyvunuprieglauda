import { useLayoutEffect, useRef } from 'react';

export default function usePageHeading(title = '', ready = true) {
  const heading = useRef(null);
  useLayoutEffect(() => {
    document.title = title ? `${title} | Gyvūnų prieglauda` : 'Gyvūnų prieglauda – rask savo draugą';
    if (ready) heading.current?.focus({ preventScroll: true });
  }, [title, ready]);
  return heading;
}
