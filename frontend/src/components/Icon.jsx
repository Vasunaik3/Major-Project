const paths = {
  dashboard: 'M3 3h8v8H3z M13 3h8v5h-8z M13 10h8v11h-8z M3 13h8v8H3z',
  sensors: 'M14 14.76V5a2 2 0 0 0-4 0v9.76a4 4 0 1 0 4 0Z M12 11v7',
  alerts: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4',
  fan: 'M12 12c-1.2-4.3 1-8 3-8 2.4 0 3 4.6-1 8 M12 12c4.3-1.2 8 1 8 3 0 2.4-4.6 3-8-1 M12 12c1.2 4.3-1 8-3 8-2.4 0-3-4.6 1-8 M12 12c-4.3 1.2-8-1-8-3 0-2.4 4.6-3 8 1 M12 12h.01',
  image: 'M4 4h16v16H4z M8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3 M20 15l-5-5L5 20',
  reports: 'M4 19V5 M4 19h17 M8 15l3-4 3 2 5-7',
  settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.7 2.94-.09-.02a1.7 1.7 0 0 0-1.8.6l-.05.08h-3.4l-.04-.08a1.7 1.7 0 0 0-1.81-.6l-.09.02-1.7-2.94.06-.06A1.7 1.7 0 0 0 9.5 15l-.08-.05v-3.4l.08-.04a1.7 1.7 0 0 0 .6-1.81l-.02-.09 2.94-1.7.06.06a1.7 1.7 0 0 0 1.88.34l.05-.08h3.4l.04.08a1.7 1.7 0 0 0 1.81.6l.09-.02 1.7 2.94-.06.06a1.7 1.7 0 0 0-.34 1.88l.08.05v3.4z',
  temperature: 'M14 14.76V5a2 2 0 0 0-4 0v9.76a4 4 0 1 0 4 0Z',
  humidity: 'M12 22s8-4 8-11a8 8 0 0 0-16 0c0 7 8 11 8 11Z',
  gas: 'M8 3c1 4-3 5-3 10a7 7 0 0 0 14 0c0-3-2-5-4-7 0 4-2 4-2 4 1-4-1-6-5-7Z',
  leaf: 'M20 4c-8 0-14 3-14 10a6 6 0 0 0 6 6c7 0 10-8 8-16Z M4 21c3-5 7-8 12-11',
  clock: 'M12 8v5l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  logout: 'M10 17l5-5-5-5 M15 12H3 M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6',
  upload: 'M12 16V4 M7 9l5-5 5 5 M4 20h16',
  check: 'm5 12 4 4L19 6',
};

export default function Icon({ name, size = 20, className = '' }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name] || paths.dashboard} />
    </svg>
  );
}
