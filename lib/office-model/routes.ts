export type Activity = 'walking' | 'coffee' | 'chatting' | 'reading';
export type Stop = {
  x: number;
  z: number;
  pause: number;
  activity?: Activity;
  facing?: number;
};
export type Route = { stops: Stop[]; speed: number };

/** Repeat a timed route, including pauses, without teleporting at the loop boundary. */
export function sampleRoute(route: Route, seconds: number) {
  const durations = route.stops.map((stop, i) => {
    const next = route.stops[(i + 1) % route.stops.length];
    return stop.pause + Math.hypot(next.x - stop.x, next.z - stop.z) / route.speed;
  });
  const duration = durations.reduce((total, value) => total + value, 0);
  let time = ((seconds % duration) + duration) % duration;
  for (let i = 0; i < route.stops.length; i++) {
    const stop = route.stops[i];
    const next = route.stops[(i + 1) % route.stops.length];
    const angle = Math.atan2(next.x - stop.x, next.z - stop.z);
    if (time < stop.pause)
      return {
        x: stop.x,
        z: stop.z,
        facing: stop.facing ?? angle,
        activity: stop.activity ?? 'chatting',
      };
    if (time < durations[i]) {
      const amount = (time - stop.pause) / (durations[i] - stop.pause);
      return {
        x: stop.x + (next.x - stop.x) * amount,
        z: stop.z + (next.z - stop.z) * amount,
        facing: angle,
        activity: 'walking' as Activity,
      };
    }
    time -= durations[i];
  }
  const first = route.stops[0];
  return {
    x: first.x,
    z: first.z,
    facing: first.facing ?? 0,
    activity: first.activity ?? 'chatting',
  };
}

const stop = (x: number, z: number, pause = 0, activity?: Activity, facing?: number): Stop => ({
  x,
  z,
  pause,
  activity,
  facing,
});
// Routes follow the central aisle and go around the island, chairs and south-wing furniture.
export const COFFEE_ROUTE: Route = {
  speed: 0.8,
  stops: [
    stop(-0.24, 4.65, 7, 'reading'),
    stop(-0.24, -8.85),
    stop(-4.25, -8.85),
    stop(-4.55, -11.05, 10, 'coffee', Math.PI),
    stop(-4.25, -8.85),
    stop(0.24, -8.85),
    stop(0.24, 4.65, 4, 'chatting'),
  ],
};
export const STUDIO_ROUTE: Route = {
  speed: 0.68,
  stops: [
    stop(0.28, -6, 4, 'reading'),
    stop(0.28, 4.7),
    stop(1.7, 4.7),
    stop(1.7, 6.8),
    stop(4.7, 6.8),
    stop(4.7, 6.8, 13, 'chatting', 0),
    stop(4.7, 6.8),
    stop(1.7, 6.8),
    stop(1.7, 4.7),
    stop(0.28, 4.7),
  ],
};
export const KITCHEN_ROUTE: Route = {
  speed: 0.6,
  stops: [
    stop(1.75, -11.6, 12, 'coffee', -Math.PI / 2),
    stop(1.75, -8.9),
    stop(-0.4, -8.9, 5, 'chatting', Math.PI / 2),
    stop(1.75, -8.9),
  ],
};
export const CHAT_LEFT: Route = {
  speed: 1,
  stops: [stop(4.2, 7.2, 60, 'chatting', Math.PI / 2)],
};
export const CHAT_RIGHT: Route = {
  speed: 1,
  stops: [stop(5.2, 7.2, 60, 'chatting', -Math.PI / 2)],
};
export const READER: Route = {
  speed: 1,
  stops: [stop(6.65, 6.55, 60, 'reading', Math.PI)],
};
