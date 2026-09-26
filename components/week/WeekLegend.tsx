import { legend } from './presence';

export function WeekLegend() {
  return (
    <ul className="week-legend" aria-label="Legend">
      {legend.map(({ tone, label }) => (
        <li key={tone}>
          <i className="tone" data-tone={tone} />
          {label}
        </li>
      ))}
      <li>
        <i className="tone" data-tone="office" data-assumed />
        Assumed in office (nothing announced)
      </li>
    </ul>
  );
}
