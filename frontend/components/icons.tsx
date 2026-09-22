import Svg, { Circle, Path, Rect } from "react-native-svg";

// 디자인에서 받은 SVG 원본을 그대로 옮긴 것. 하드코딩된 색만 color prop으로 바꿨다.
// ponytail: clipPath(전체 영역을 덮는 rect)는 no-op이라 생략했다.
const MUTED = "#6B7280";
const TAB_INACTIVE = "#9CA3AF";

type IconProps = { size?: number; color?: string };

export function BellIcon({ size = 24, color = MUTED, hasBadge = false }: IconProps & { hasBadge?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Path
        d="M10 2.5C7.5 2.5 6 4.5 6 7V9.5C6 10.5 5.5 11.5 4.5 12.3H15.5C14.5 11.5 14 10.5 14 9.5V7C14 4.5 12.5 2.5 10 2.5Z"
        stroke={color}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      <Path
        d="M8 14.5C8 15.0304 8.21071 15.5391 8.58579 15.9142C8.96086 16.2893 9.46957 16.5 10 16.5C10.5304 16.5 11.0391 16.2893 11.4142 15.9142C11.7893 15.5391 12 15.0304 12 14.5"
        stroke={color}
        strokeWidth={1.4}
        strokeLinecap="round"
      />
      {hasBadge ? <Circle cx={16.5} cy={3.5} r={2.9} fill="#2761FF" stroke="white" strokeWidth={1.2} /> : null}
    </Svg>
  );
}

export function ProfileIcon({ size = 24, color = MUTED }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Path
        d="M9.99999 10.2C11.7673 10.2 13.2 8.7673 13.2 6.99999C13.2 5.23268 11.7673 3.79999 9.99999 3.79999C8.23268 3.79999 6.79999 5.23268 6.79999 6.99999C6.79999 8.7673 8.23268 10.2 9.99999 10.2Z"
        stroke={color}
        strokeWidth={1.5}
      />
      <Path d="M3.5 17C3.5 13.5 6.4 11 10 11C13.6 11 16.5 13.5 16.5 17" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

export function HomeTabIcon({ size = 22, color = TAB_INACTIVE }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
      <Path
        d="M18.6 15.9745V10.9954V10.9947C18.6 10.5156 18.6 10.2759 18.535 10.0529C18.4775 9.85516 18.3826 9.66763 18.2547 9.49852C18.1104 9.3077 17.9095 9.14985 17.5074 8.83406L12.7074 5.06472C11.9608 4.47842 11.5875 4.18531 11.1674 4.07381C10.7972 3.97556 10.4028 3.97556 10.0326 4.07381C9.6127 4.18525 9.23977 4.4781 8.49398 5.06376L8.49275 5.06472L3.69275 8.83406L3.69179 8.83481C3.2903 9.1501 3.08941 9.30785 2.94519 9.49852C2.81728 9.66763 2.72252 9.85516 2.66495 10.0529C2.59998 10.2761 2.59998 10.5158 2.59998 10.9954V15.9745C2.59998 16.8108 2.59998 17.2289 2.75222 17.5587C2.9552 17.9985 3.34478 18.348 3.83484 18.5302C4.20238 18.6668 4.66832 18.6668 5.60021 18.6668C6.53209 18.6668 6.9978 18.6668 7.36534 18.5302C7.8554 18.348 8.24464 17.9985 8.44763 17.5587C8.59987 17.2289 8.59998 16.8107 8.59998 15.9744V15.0769C8.59998 14.0856 9.49541 13.282 10.6 13.282C11.7045 13.282 12.6 14.0856 12.6 15.0769V15.9744C12.6 16.8107 12.6 17.2289 12.7522 17.5587C12.9552 17.9985 13.3448 18.348 13.8348 18.5302C14.2024 18.6668 14.6683 18.6668 15.6002 18.6668C16.5321 18.6668 16.9978 18.6668 17.3653 18.5302C17.8554 18.348 18.2446 17.9985 18.4476 17.5587C18.5999 17.2289 18.6 16.8108 18.6 15.9745Z"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function NoticeTabIcon({ size = 22, color = TAB_INACTIVE }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
      <Path
        d="M10.6267 8.27273C10.1927 8.27273 9.34489 8.27273 7.71099 8.27273C3.82968 8.27273 3.82963 14.2727 7.71099 14.2727C8.13024 14.2727 8.49773 14.2727 8.81975 14.2727C9.75272 14.2727 10.3041 14.2727 10.6267 14.2727M10.6267 8.27273C11.2236 8.27273 11.0377 8.27273 11.0377 8.27273C14.4425 8.06071 18.8 5 18.8 5V17C18.8 17 14.1601 14.2403 11.0377 14.2727C11.0377 14.2727 11.2237 14.2727 10.6267 14.2727M10.6267 8.27273V14.2727"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M8.29999 15C8.3455 16.5655 9.29999 17.5 9.29999 17.5" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// 참여활동 상세 대표 이미지 플레이스홀더 — 디자인 icon/image 36px, stroke 1.7 #999999.
export function ImagePlaceholderIcon({ size = 36, color = "#999999" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 36 36" fill="none">
      <Rect x={4.5} y={6} width={27} height={24} rx={3} stroke={color} strokeWidth={1.7} />
      <Circle cx={12.8} cy={14.2} r={2.4} stroke={color} strokeWidth={1.5} />
      <Path d="M4.5 25.5L13 18L20 24L25 19.5L31.5 25.5" stroke={color} strokeWidth={1.7} strokeLinejoin="round" />
    </Svg>
  );
}

// 원우회 답변 타이틀 아이콘 — 💬 이모지(말풍선+점 3개) 모양을 벡터로 그렸다.
// (이모지는 윈도우 등 일부 환경에서 렌더링되지 않아 SVG로 대체)
export function CouncilReplyIcon({ size = 15, color = "#2761FF" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Path
        d="M8 1.5C3.86 1.5 0.5 4.28 0.5 7.7C0.5 9.6 1.54 11.29 3.17 12.42C3.05 13.22 2.7 14.13 2 14.83C1.83 15 1.95 15.29 2.19 15.27C3.83 15.12 5.17 14.42 6.02 13.75C6.66 13.88 7.32 13.95 8 13.95C12.14 13.95 15.5 11.12 15.5 7.7C15.5 4.28 12.14 1.5 8 1.5Z"
        fill={color}
      />
      <Circle cx={4.9} cy={7.8} r={1.05} fill="#FFFFFF" />
      <Circle cx={8} cy={7.8} r={1.05} fill="#FFFFFF" />
      <Circle cx={11.1} cy={7.8} r={1.05} fill="#FFFFFF" />
    </Svg>
  );
}

export function CommunityTabIcon({ size = 22, color = TAB_INACTIVE }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
      <Path
        d="M17 16L13 16L11 18L9 16L5 16C3.89543 16 3 15.1046 3 14L3 7C3 5.89543 3.89543 5 5 5L17 5C18.1046 5 19 5.89543 19 7L19 14C19 15.1046 18.1046 16 17 16Z"
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <Path d="M6 12H12" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M6 9H16" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

// 빈 상태(등록된 공지사항이 없어요)용 캘린더.
export function EmptyCalendarIcon({ size = 32, color = "#A6ACB7" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path
        d="M25.3333 6.66663H6.66667C5.19391 6.66663 4 7.86053 4 9.33329V25.3333C4 26.8061 5.19391 28 6.66667 28H25.3333C26.8061 28 28 26.8061 28 25.3333V9.33329C28 7.86053 26.8061 6.66663 25.3333 6.66663Z"
        stroke={color}
        strokeWidth={2}
      />
      <Path d="M21.3333 4V9.33333M10.6667 4V9.33333M4 13.3333H28" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

// 원본 SVG(69x39)에 "원우회" 라벨 텍스트 패스가 함께 있어서 아이콘 패스만 옮겼다.
// 좌표를 다시 그리는 대신 viewBox로 아이콘 영역만 잘라내 stroke 두께(1.55833)를 원본 그대로 유지한다.
export function CouncilTabIcon({ size = 22, color = "#A6ACB7" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="22.5 0.5 22 22" fill="none">
      <Path
        d="M31.65 10.0834C33.1688 10.0834 34.4 8.85216 34.4 7.33337C34.4 5.81459 33.1688 4.58337 31.65 4.58337C30.1312 4.58337 28.9 5.81459 28.9 7.33337C28.9 8.85216 30.1312 10.0834 31.65 10.0834Z"
        stroke={color}
        strokeWidth={1.55833}
      />
      <Path
        d="M38.9834 10.5417C40.249 10.5417 41.275 9.51569 41.275 8.25004C41.275 6.98439 40.249 5.95837 38.9834 5.95837C37.7177 5.95837 36.6917 6.98439 36.6917 8.25004C36.6917 9.51569 37.7177 10.5417 38.9834 10.5417Z"
        stroke={color}
        strokeWidth={1.55833}
      />
      <Path
        d="M25.2333 18.3334C25.2333 15.3084 28.075 12.8334 31.65 12.8334C35.225 12.8334 38.0667 15.3084 38.0667 18.3334"
        stroke={color}
        strokeWidth={1.55833}
        strokeLinecap="round"
      />
      <Path d="M37.6083 13.0167C39.9917 13.4751 41.7333 15.2167 41.7333 18.3334" stroke={color} strokeWidth={1.55833} strokeLinecap="round" />
    </Svg>
  );
}

// 이 아이콘만 stroke가 아니라 fill 기반이다 (디자인 원본 그대로).
export function ParticipationTabIcon({ size = 22, color = TAB_INACTIVE }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Path
        d="M4.16667 18.3333C3.70833 18.3333 3.31597 18.1701 2.98958 17.8437C2.66319 17.5173 2.5 17.125 2.5 16.6666V4.99996C2.5 4.54163 2.66319 4.14926 2.98958 3.82288C3.31597 3.49649 3.70833 3.33329 4.16667 3.33329H5V1.66663H6.66667V3.33329H13.3333V1.66663H15V3.33329H15.8333C16.2917 3.33329 16.684 3.49649 17.0104 3.82288C17.3368 4.14926 17.5 4.54163 17.5 4.99996V16.6666C17.5 17.125 17.3368 17.5173 17.0104 17.8437C16.684 18.1701 16.2917 18.3333 15.8333 18.3333H4.16667ZM4.16667 16.6666H15.8333V8.33329H4.16667V16.6666ZM4.16667 6.66663H15.8333V4.99996H4.16667V6.66663ZM5.83333 11.6666V9.99996H14.1667V11.6666H5.83333ZM5.83333 15V13.3333H11.6667V15H5.83333Z"
        fill={color}
      />
    </Svg>
  );
}

// 더보기(케밥) 아이콘 — 디자인 원본 4x18, 세로 점 3개.
export function MoreIcon({ size = 18, color = "#15171C" }: IconProps) {
  return (
    <Svg width={(size * 4) / 18} height={size} viewBox="0 0 4 18" fill="none">
      <Circle cx={2} cy={2} r={2} fill={color} />
      <Circle cx={2} cy={9} r={2} fill={color} />
      <Circle cx={2} cy={16} r={2} fill={color} />
    </Svg>
  );
}

// 북마크 아이콘 — 디자인 원본 20x20, stroke 1.6. filled면 같은 패스를 채운다.
export function BookmarkIcon({ size = 20, color = "#15171C", filled = false }: IconProps & { filled?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Path
        d="M6 3.7998H14C14.6627 3.7998 15.2002 4.33726 15.2002 5V14.8809C15.2002 15.0499 15.0035 15.1426 14.873 15.0352L10.5088 11.4414L10 11.0225L9.49121 11.4414L5.12695 15.0352C4.99648 15.1426 4.7998 15.0499 4.7998 14.8809V5C4.7998 4.33726 5.33726 3.7998 6 3.7998Z"
        fill={filled ? color : "none"}
        stroke={color}
        strokeWidth={1.6}
      />
    </Svg>
  );
}

// 활동 사진 업로드 카메라 아이콘 — 디자인 원본 26x26. (0-면적 fill 패스는 생략)
export function CameraAddIcon({ size = 26, color = "#A6ACB7" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
      <Path d="M21 8H5C3.89543 8 3 8.89543 3 10V20C3 21.1046 3.89543 22 5 22H21C22.1046 22 23 21.1046 23 20V10C23 8.89543 22.1046 8 21 8Z" stroke={color} strokeWidth={1.6} />
      <Path d="M9 8L10.5 5.5H15.5L17 8" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
      <Path d="M13 18.5C14.933 18.5 16.5 16.933 16.5 15C16.5 13.067 14.933 11.5 13 11.5C11.067 11.5 9.5 13.067 9.5 15C9.5 16.933 11.067 18.5 13 18.5Z" stroke={color} strokeWidth={1.6} />
      <Path d="M19 11V14M17.5 12.5H20.5" stroke={color} strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}

// 뒤로가기 아이콘 — 디자인 원본 22x22, stroke 1.8.
export function BackIcon({ size = 22, color = "#15171C" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
      <Path d="M14 4L6 11L14 18" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// 닫기(X) 아이콘 — 디자인 원본 20x20, stroke 1.8.
export function CloseIcon({ size = 20, color = "#15171C" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Path d="M4 4L16 16M16 4L4 16" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

// 더보기 메뉴 '수정' 아이콘 — 디자인 원본 20x20, stroke 1.4.
export function PencilIcon({ size = 20, color = "#15171C" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Path d="M13.5 2.5L17.5 6.5L7 17H3V13L13.5 2.5Z" stroke={color} strokeWidth={1.4} strokeLinejoin="round" />
    </Svg>
  );
}

// 더보기 메뉴 '삭제' 아이콘 — 디자인 원본 20x20, stroke 1.4.
export function TrashIcon({ size = 20, color = "#D64545" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Path d="M4 6H16M8 6V4H12V6M6 6L6.6 16H13.4L14 6" stroke={color} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// 더보기 메뉴 '신고' 아이콘 — 디자인 원본 20x20, stroke 1.4.
export function FlagIcon({ size = 20, color = "#15171C" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Path d="M5 2.5V17.5M5 3.5H14L11.7 6.5L14 9.5H5" stroke={color} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// 완료 화면 체크 아이콘 — 디자인 원본 64x64.
export function CheckCircleIcon({ size = 64, color = "#2E9E5B" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Path d="M32 56C45.2548 56 56 45.2548 56 32C56 18.7452 45.2548 8 32 8C18.7452 8 8 18.7452 8 32C8 45.2548 18.7452 56 32 56Z" stroke={color} strokeWidth={4} />
      <Path d="M21.3335 33.3335L28.0002 40.0002L42.6668 25.3335" stroke={color} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// 알림 목록 타입 아이콘 — 디자인 원본 36x36, 배경 원 포함.
export function NotificationCommentIcon({ size = 36 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 36 36" fill="none">
      <Rect width={36} height={36} rx={18} fill="#EEEDFE" />
      <Path
        d="M19.0859 11C15.268 11.0002 12.1729 14.1336 12.1729 17.999C12.1729 19.0862 12.4185 20.1152 12.8555 21.0332L10.4443 24.998L16.0527 24.2881C16.9687 24.7418 17.9975 24.998 19.0859 24.998C22.904 24.998 25.9999 21.8645 26 17.999C26 14.1334 22.9041 11 19.0859 11Z"
        stroke="#3C3489"
        strokeWidth={1.5}
      />
    </Svg>
  );
}

export function NotificationEventIcon({ size = 36 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 36 36" fill="none">
      <Rect width={36} height={36} rx={18} fill="#EAF3DE" />
      <Path d="M22.5 13H13.5C12.6716 13 12 13.6716 12 14.5V22.5C12 23.3284 12.6716 24 13.5 24H22.5C23.3284 24 24 23.3284 24 22.5V14.5C24 13.6716 23.3284 13 22.5 13Z" stroke="#3B6D11" strokeWidth={1.5} />
      <Path d="M12 16.5H24" stroke="#3B6D11" strokeWidth={1.5} />
      <Path d="M15 11.5V14.5M21 11.5V14.5" stroke="#3B6D11" strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

export function NotificationCouncilIcon({ size = 36 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 36 36" fill="none">
      <Rect width={36} height={36} rx={18} fill="#FAEEDA" />
      <Circle cx={18} cy={13.7998} r={2.25} stroke="#854F0B" strokeWidth={1.5} />
      <Circle cx={22} cy={16.7002} r={2.25} stroke="#854F0B" strokeWidth={1.5} />
      <Circle cx={20.47} cy={21.3999} r={2.25} stroke="#854F0B" strokeWidth={1.5} />
      <Circle cx={15.53} cy={21.3999} r={2.25} stroke="#854F0B" strokeWidth={1.5} />
      <Circle cx={14} cy={16.7002} r={2.25} stroke="#854F0B" strokeWidth={1.5} />
      <Circle cx={18} cy={18} r={1.5} stroke="#854F0B" />
    </Svg>
  );
}

export function NotificationLikeIcon({ size = 36 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 36 36" fill="none">
      <Rect width={36} height={36} rx={18} fill="#FBEAF0" />
      <Path
        d="M21.1426 12.75C22.6804 12.7502 24 14.1711 24 15.7363C23.9998 17.827 22.5343 19.7012 20.8848 21.126C20.0784 21.8225 19.2683 22.3765 18.6582 22.7568C18.3948 22.921 18.169 23.0504 18 23.1455C17.831 23.0504 17.6052 22.921 17.3418 22.7568C16.7317 22.3765 15.9216 21.8225 15.1152 21.126C13.4657 19.7012 12.0002 17.827 12 15.7363C12 14.2201 13.2383 12.8389 14.7139 12.7539L14.8574 12.75C15.8993 12.7501 16.8499 13.2973 17.3506 14.1641L18 15.2881L18.6494 14.1641C19.1188 13.3514 19.9835 12.8201 20.9482 12.7568L21.1426 12.75Z"
        stroke="#993556"
        strokeWidth={1.5}
      />
    </Svg>
  );
}

// 기장단 소개 아바타 플레이스홀더 — 디자인 원본 48x48, 배경 원 포함.
export function PersonAvatarIcon({ size = 48 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Circle cx={24} cy={24} r={24} fill="#E6F1FB" />
      <Path d="M24.0002 23.9998C26.5775 23.9998 28.6668 21.9105 28.6668 19.3332C28.6668 16.7558 26.5775 14.6665 24.0002 14.6665C21.4228 14.6665 19.3335 16.7558 19.3335 19.3332C19.3335 21.9105 21.4228 23.9998 24.0002 23.9998Z" fill="white" />
      <Path d="M14.6665 33.3333C14.6665 28.2 18.8665 24 23.9998 24C29.1332 24 33.3332 28.2 33.3332 33.3333" fill="white" />
    </Svg>
  );
}

// 캘린더 다음 달 화살표 — BackIcon 좌우 반전.
export function ForwardIcon({ size = 22, color = "#15171C" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
      <Path d="M8 4L16 11L8 18" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// 회계장부 안내 아이콘 — 디자인 원본 40x40, stroke 1.6.
export function LedgerIcon({ size = 40, color = "#A6ACB7" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <Path d="M31 8H9C7.34315 8 6 9.34315 6 11V29C6 30.6569 7.34315 32 9 32H31C32.6569 32 34 30.6569 34 29V11C34 9.34315 32.6569 8 31 8Z" stroke={color} strokeWidth={1.6} />
      <Path d="M6 15H34" stroke={color} strokeWidth={1.6} />
      <Path d="M12 21H18M12 26H22" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

export function NotificationSuggestionIcon({ size = 36 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 36 36" fill="none">
      <Rect width={36} height={36} rx={18} fill="#E0F6F0" />
      <Path d="M18 24.75C21.7279 24.75 24.75 21.7279 24.75 18C24.75 14.2721 21.7279 11.25 18 11.25C14.2721 11.25 11.25 14.2721 11.25 18C11.25 21.7279 14.2721 24.75 18 24.75Z" stroke="#066B5C" strokeWidth={1.7} />
      <Path d="M15 18.375L16.875 20.25L21 16.125" stroke="#066B5C" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// FAQ 빈 상태 문서 아이콘 — 디자인 원본 32x32.
export function EmptyDocumentIcon({ size = 32, color = "#A6ACB7" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path d="M8 5H20L26 11V26C26 26.5304 25.7893 27.0391 25.4142 27.4142C25.0391 27.7893 24.5304 28 24 28H8C7.46957 28 6.96086 27.7893 6.58579 27.4142C6.21071 27.0391 6 26.5304 6 26V7C6 6.46957 6.21071 5.96086 6.58579 5.58579C6.96086 5.21071 7.46957 5 8 5Z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M18 5V11H26" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Rect x={10} y={14} width={12} height={2} rx={0.65} fill={color} />
      <Rect x={10} y={18} width={12} height={2} rx={0.65} fill={color} />
      <Rect x={10} y={22} width={8} height={2} rx={0.65} fill={color} />
    </Svg>
  );
}

// 사진첩 상세 좌우 이동 화살표 — 디자인 원본, 흰색 stroke 2 / opacity 0.9.
export function GalleryPrevIcon({ size = 28, color = "#FFFFFF" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <Path opacity={0.9} d="M17 6L8 14L17 22" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function GalleryNextIcon({ size = 28, color = "#FFFFFF" }: IconProps) {
  return (
    <Svg width={(size * 36) / 28} height={size} viewBox="0 0 36 28" fill="none">
      <Path opacity={0.9} d="M11 6L20 14L11 22" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// 글쓰기 이미지 첨부 아이콘 — 디자인 원본 16x16.
export function AttachImageIcon({ size = 16, color = "#6B7280" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Path d="M12.5 3H3.5C2.67157 3 2 3.67157 2 4.5V11.5C2 12.3284 2.67157 13 3.5 13H12.5C13.3284 13 14 12.3284 14 11.5V4.5C14 3.67157 13.3284 3 12.5 3Z" stroke={color} strokeWidth={1.3} />
      <Path d="M5 7C5.55228 7 6 6.55228 6 6C6 5.44772 5.55228 5 5 5C4.44772 5 4 5.44772 4 6C4 6.55228 4.44772 7 5 7Z" fill={color} />
      <Path d="M3 11L6.5 7.5L8.5 9.5L11 7L13 9" stroke={color} strokeWidth={1.3} strokeLinejoin="round" />
    </Svg>
  );
}

// 글쓰기 파일 첨부 아이콘(클립) — 디자인 원본 16x16.
export function AttachFileIcon({ size = 16, color = "#6B7280" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Path
        d="M14.0001 6.33336L8.33343 12C7.76763 12.5658 7.00025 12.8837 6.20009 12.8837C5.39994 12.8837 4.63256 12.5658 4.06676 12C3.50097 11.4342 3.18311 10.6668 3.18311 9.86669C3.18311 9.06654 3.50097 8.29915 4.06676 7.73336L9.33343 2.46669C9.71357 2.08655 10.2292 1.87299 10.7668 1.87299C11.3044 1.87299 11.82 2.08655 12.2001 2.46669C12.5802 2.84684 12.7938 3.36242 12.7938 3.90003C12.7938 4.43763 12.5802 4.95322 12.2001 5.33336L6.66676 10.8667"
        stroke={color}
        strokeWidth={1.3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// 활동 인증 사진 슬라이더 좌우 버튼 — 검정 35% 원 + 흰 화살표 (디자인 원본 28x28).
export function SliderNextIcon({ size = 28 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <Path opacity={0.35} d="M14 28C21.732 28 28 21.732 28 14C28 6.26801 21.732 0 14 0C6.26801 0 0 6.26801 0 14C0 21.732 6.26801 28 14 28Z" fill="black" />
      <Path d="M12 8L18 14L12 20" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function SliderPrevIcon({ size = 28 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <Path opacity={0.35} d="M14 28C21.732 28 28 21.732 28 14C28 6.26801 21.732 0 14 0C6.26801 0 0 6.26801 0 14C0 21.732 6.26801 28 14 28Z" fill="black" />
      <Path d="M16 8L10 14L16 20" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// 활동 인증/상조회 날짜 달력 아이콘 — 디자인 원본 15x15, stroke 1.22.
export function CalendarSmallIcon({ size = 15, color = "#6B7280" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 15 15" fill="none">
      <Path d="M11.875 3.125H3.125C2.43464 3.125 1.875 3.68464 1.875 4.375V11.875C1.875 12.5654 2.43464 13.125 3.125 13.125H11.875C12.5654 13.125 13.125 12.5654 13.125 11.875V4.375C13.125 3.68464 12.5654 3.125 11.875 3.125Z" stroke={color} strokeWidth={1.22} />
      <Path d="M10 1.875V4.375M5 1.875V4.375M1.875 6.25H13.125" stroke={color} strokeWidth={1.22} strokeLinecap="round" />
    </Svg>
  );
}

// 회원 탈퇴 헤더 경고 아이콘 — 디자인 원본 32x32, stroke 1.7.
export function AlertCircleIcon({ size = 32, color = "#6B7280" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path d="M16 28C22.6274 28 28 22.6274 28 16C28 9.37258 22.6274 4 16 4C9.37258 4 4 9.37258 4 16C4 22.6274 9.37258 28 16 28Z" stroke={color} strokeWidth={1.7} />
      <Path d="M16 10.6665V17.3332M16 21.3332V21.3465" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  );
}

// 안내 배너용 작은 경고(느낌표) 아이콘 — 디자인 원본 14x14, stroke 1.1375.
export function NoticeAlertIcon({ size = 14, color = "#854F0B" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <Path d="M7 12.6875C10.1411 12.6875 12.6875 10.1411 12.6875 7C12.6875 3.85888 10.1411 1.3125 7 1.3125C3.85888 1.3125 1.3125 3.85888 1.3125 7C1.3125 10.1411 3.85888 12.6875 7 12.6875Z" stroke={color} strokeWidth={1.1375} />
      <Path d="M7 4.375V7.875" stroke={color} strokeWidth={1.1375} strokeLinecap="round" />
      <Path d="M7 10.5001C7.3866 10.5001 7.7 10.1867 7.7 9.8001C7.7 9.4135 7.3866 9.1001 7 9.1001C6.6134 9.1001 6.3 9.4135 6.3 9.8001C6.3 10.1867 6.6134 10.5001 7 10.5001Z" fill={color} />
    </Svg>
  );
}

// 토스트용 경고 아이콘 — 디자인 원본 18x18. 채워진 원 위에 흰 느낌표라
// NoticeAlertIcon(테두리만 있는 원)과 다르다. color는 원의 채움색이다.
export function ToastAlertIcon({ size = 18, color = "#D64545" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <Path d="M9 18C13.9706 18 18 13.9706 18 9C18 4.02944 13.9706 0 9 0C4.02944 0 0 4.02944 0 9C0 13.9706 4.02944 18 9 18Z" fill={color} />
      <Path d="M9 5V9.8" stroke="#FFFFFF" strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M9 13.6C9.55228 13.6 10 13.1523 10 12.6C10 12.0477 9.55228 11.6 9 11.6C8.44772 11.6 8 12.0477 8 12.6C8 13.1523 8.44772 13.6 9 13.6Z" fill="#FFFFFF" />
    </Svg>
  );
}

// 기본 프로필 아바타 — 디자인 원본 80x80 (파란 배경 원 + 흰 실루엣, 카메라 배지는 별도 오버레이).
export function DefaultAvatarIcon({ size = 80 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 80 80" fill="none">
      <Rect width={80} height={80} rx={40} fill="#E6F1FB" />
      <Path d="M40 39.9998C44.2342 39.9998 47.6667 36.5674 47.6667 32.3332C47.6667 28.099 44.2342 24.6665 40 24.6665C35.7658 24.6665 32.3333 28.099 32.3333 32.3332C32.3333 36.5674 35.7658 39.9998 40 39.9998Z" fill="#FFFFFF" />
      <Path d="M24.6667 55.3333C24.6667 46.9 31.5667 40 40 40C48.4333 40 55.3333 46.9 55.3333 55.3333" fill="#FFFFFF" />
    </Svg>
  );
}

// 댓글 전송 버튼 — 디자인 원본 36x36 (파란 원 + 흰 종이비행기).
export function SendIcon({ size = 36 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 36 36" fill="none">
      <Rect width={36} height={36} rx={18} fill="#2761FF" />
      <Path d="M11.5 18L24.5 12.5L20 25.5L17.5 20L12 18H11.5Z" stroke="#FFFFFF" strokeWidth={1.4} strokeLinejoin="round" />
    </Svg>
  );
}

// 공지 첨부파일 다운로드 아이콘 — 디자인 원본 18x18.
export function DownloadIcon({ size = 18, color = "#2761FF" }: IconProps) {
  // 디자인 원본 18x18: 아래 화살표 + 밑줄.
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <Path d="M9 2.5V11.5M12.5 8L9 11.5L5.5 8" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M3.5 14H14.5" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

// 공지 알림 토스트 아이콘 — 디자인 원본 32x32 (뱃지 원 + 종).
export function NoticeToastIcon({ size = 32 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Rect width={32} height={32} rx={16} fill="#E6F1FB" />
      <Path
        d="M12.0001 14C12.0001 12.9391 12.4215 11.9217 13.1717 11.1716C13.9218 10.4214 14.9392 10 16.0001 10C17.0609 10 18.0784 10.4214 18.8285 11.1716C19.5787 11.9217 20.0001 12.9391 20.0001 14C20.0001 16.6667 21.3334 17.3333 21.3334 18H10.6667C10.6667 17.3333 12.0001 16.6667 12.0001 14Z"
        stroke="#0C447C"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M14.6667 20.6667C14.6667 21.0203 14.8072 21.3594 15.0573 21.6095C15.3073 21.8595 15.6465 22 16.0001 22C16.3537 22 16.6928 21.8595 16.9429 21.6095C17.1929 21.3594 17.3334 21.0203 17.3334 20.6667"
        stroke="#0C447C"
        strokeWidth={1.7}
        strokeLinecap="round"
      />
    </Svg>
  );
}

// 공지 첨부링크 바로가기 아이콘 — 디자인 원본 18x18.
export function ExternalLinkIcon({ size = 18, color = "#2761FF" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <Path d="M7 2H4C2.89543 2 2 2.89543 2 4V14C2 15.1046 2.89543 16 4 16H14C15.1046 16 16 15.1046 16 14V11" stroke={color} strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M11 2H16V7" stroke={color} strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M16.0005 2L9.00049 9" stroke={color} strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// 공지 첨부 PDF/문서 아이콘 — 디자인 원본 18x18.
export function AttachDocIcon({ size = 18, color = "#6B7280" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <Path d="M4.99997 2.5H11L14 5.5V13.5C14 13.8978 13.8419 14.2794 13.5606 14.5607C13.2793 14.842 12.8978 15 12.5 15H4.99997C4.69323 14.8921 4.42984 14.6875 4.24948 14.417C4.06912 14.1464 3.98155 13.8246 3.99997 13.5V4C3.99997 3.60218 4.158 3.22064 4.43931 2.93934C4.72061 2.65804 5.10214 2.5 5.49997 2.5H4.99997Z" stroke={color} strokeWidth={1.4} strokeLinejoin="round" />
      <Path d="M11 2.5V5.5H14" stroke={color} strokeWidth={1.4} strokeLinejoin="round" />
    </Svg>
  );
}

// 공지 첨부링크 체인 아이콘 — 디자인 원본 16x16.
export function AttachLinkIcon({ size = 16, color = "#6B7280" }: IconProps) {
  // 디자인 원본 16x16 (stroke 1.3): 상조회 신청 링크입력필드 아이콘.
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Path d="M7.99994 9.00016H8.97127C10.0919 9.00016 10.9999 8.00694 10.9999 6.70027C10.9999 6.07257 10.7862 5.47057 10.4058 5.02671C10.0253 4.58285 9.5093 4.3335 8.97127 4.3335H4.99992H3.36192C2.24125 4.3335 1.33325 5.32672 1.33325 6.63338C1.33325 7.26109 1.54699 7.86309 1.92743 8.30695C2.30788 8.75081 2.82388 9.00016 3.36192 9.00016" stroke={color} strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M8.33332 6.99984H7.36198C6.24132 6.99984 5.33332 7.99306 5.33332 9.29973C5.33332 9.92743 5.54705 10.5294 5.9275 10.9733C6.30795 11.4171 6.82395 11.6665 7.36198 11.6665H11.3333H12.9713C14.092 11.6665 15 10.6733 15 9.36662C15 8.73891 14.7863 8.13691 14.4058 7.69305C14.0254 7.24919 13.5094 6.99984 12.9713 6.99984" stroke={color} strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// 상단바 돋보기 아이콘 — 디자인 원본 20x20, stroke 1.6.
export function SearchIcon({ size = 20, color = "#15171C" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Path d="M8 14C11.3137 14 14 11.3137 14 8C14 4.68629 11.3137 2 8 2C4.68629 2 2 4.68629 2 8C2 11.3137 4.68629 14 8 14Z" stroke={color} strokeWidth={1.6} />
      <Path d="M13 13L17 17" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

// 게시판 검색 모드 뒤로가기 — 디자인 원본 10x16, stroke 1.6.
export function SearchBackIcon({ size = 16, color = "#15171C" }: IconProps) {
  return (
    <Svg width={(size * 10) / 16} height={size} viewBox="0 0 10 16" fill="none">
      <Path d="M8.33317 1.6001L1.6665 8.0001L8.33317 14.4001" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// 일정 세부사항 날짜행 달력 아이콘 — 디자인 원본 15x15, stroke 1.21875.
export function EventCalendarIcon({ size = 15, color = "#6B7280" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 15 15" fill="none">
      <Path d="M11.7188 2.8125H3.28125C2.5046 2.8125 1.875 3.4421 1.875 4.21875V11.7188C1.875 12.4954 2.5046 13.125 3.28125 13.125H11.7188C12.4954 13.125 13.125 12.4954 13.125 11.7188V4.21875C13.125 3.4421 12.4954 2.8125 11.7188 2.8125Z" stroke={color} strokeWidth={1.21875} />
      <Path d="M1.875 6.09375H13.125" stroke={color} strokeWidth={1.21875} />
      <Path d="M4.6875 1.875V4.125M10.3125 1.875V4.125" stroke={color} strokeWidth={1.21875} strokeLinecap="round" />
    </Svg>
  );
}

// 알림 목록 공지 아이콘 — 디자인 원본 36x36, 배경 원 포함.
export function NotificationNoticeIcon({ size = 36 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 36 36" fill="none">
      <Rect width={36} height={36} rx={18} fill="#E6F1FB" />
      <Path d="M18 11.5C15.8 11.5 14.3 13.3 14.3 15.5V17.8C14.3 18.8 13.9 19.6 13 20.4H23C22.1 19.6 21.7 18.8 21.7 17.8V15.5C21.7 13.3 20.2 11.5 18 11.5Z" stroke="#0C447C" strokeWidth={1.5} strokeLinejoin="round" />
      <Path d="M16.2 22.2002C16.2 22.6776 16.3896 23.1354 16.7272 23.473C17.0647 23.8106 17.5226 24.0002 18 24.0002C18.4773 24.0002 18.9352 23.8106 19.2727 23.473C19.6103 23.1354 19.8 22.6776 19.8 22.2002" stroke="#0C447C" strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

// 활동 인증 참가자 추가 버튼 — 디자인 원본 28x28 (파란 테두리 원 + 플러스).
export function ParticipantAddIcon({ size = 28, color = "#2761FF" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <Rect x={0.65} y={0.65} width={26.7} height={26.7} rx={13.35} stroke={color} strokeWidth={1.3} />
      <Path d="M14.0002 9.33325V18.6666M9.3335 13.9999H18.6668" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
    </Svg>
  );
}

// 목록 행 우측 셰브론 — 디자인 원본 15x15 (stroke 1.5, #A6ACB7).
export function ChevronRightIcon({ size = 15, color = "#A6ACB7" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 15 15" fill="none">
      <Path d="M5.625 2.8125L10.3125 7.5L5.625 12.1875" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
