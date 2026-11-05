import { makeInkField } from './ink-transitions.js';
self.onmessage = ({data: {width, height, style, revision}}) => {
  const map = makeInkField(width, height, style);
  self.postMessage({map, revision}, [map.field.buffer, map.revealField.buffer, map.pigment.buffer, map.fiber.buffer]);
};
