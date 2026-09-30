import { CSSProperties } from "react";
export type IconName =
  | "camera"
  | "video"
  | "both"
  | "home"
  | "calendar"
  | "user"
  | "pin"
  | "shield"
  | "card"
  | "arrow"
  | "back"
  | "bolt"
  | "check"
  | "bell"
  | "download";
const paths: Record<IconName, React.ReactNode> = {
  camera: (
    <>
      <path d="M8 5 9.5 3h5L16 5h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
      <circle cx="12" cy="13" r="4" />
    </>
  ),
  video: (
    <>
      <rect x="2" y="5" width="13" height="14" rx="3" />
      <path d="m15 10 7-4v12l-7-4" />
    </>
  ),
  both: (
    <>
      <path d="M3 7h3l1-2h4l1 2h3v12H3Z" />
      <circle cx="9" cy="13" r="3" />
      <path d="M18 8h2v9h-2M20 10l3-2v9l-3-2" />
    </>
  ),
  home: <path d="m3 10 9-7 9 7v11h-6v-7H9v7H3Z" />,
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M7 2v6m10-6v6M3 11h18m-13 4h1m6 0h1m-8 3h1" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="7" r="4" />
      <path d="M3 22v-2a9 9 0 0 1 18 0v2Z" />
    </>
  ),
  pin: (
    <>
      <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  shield: (
    <>
      <path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6Z" />
      <path d="m7 12 3 3 7-7" />
    </>
  ),
  card: (
    <>
      <rect x="2" y="4" width="20" height="16" rx="3" />
      <path d="M2 10h20m-15 5h4" />
      <circle cx="17" cy="15" r="1" />
    </>
  ),
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  back: <path d="M20 12H4m6-6-6 6 6 6" />,
  bolt: <path d="m14 2-10 12h7l-1 8L21 9h-8Z" />,
  check: <path d="m5 12 4 4L20 5" />,
  bell: <path d="M5 17V9a7 7 0 0 1 14 0v8l2 2H3Zm5 5h4" />,
  download: <path d="M12 2v13m-5-5 5 5 5-5M3 17v5h18v-5" />,
};
export default function Icon({
  name,
  size = 24,
  style,
}: {
  name: IconName;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      {paths[name]}
    </svg>
  );
}
